import { createScraperClient } from './db';
import { getMappingsForCard, type SourceMapping } from './mapping';
import { revalidateCardPage } from './revalidate';
import {
  persistObservations,
  type CardRef,
  type PriceObservation,
  type PriceSource,
} from './write-path';

export type WorkerCard = CardRef & {
  tcg_player_id?: string | null;
  print_run_info?: unknown;
  yuyutei_url?: string | null;
  cardrush_url?: string | null;
  sets?: { name?: string | null } | null;
};

export interface QueueQuery {
  ilike(column: string, pattern: string): QueueQuery;
  not(column: string, operator: string, value: string): QueueQuery;
  toSql(): { where: string; params: string[] };
}

export interface WorkerConfig {
  label: string;
  queueFilter: (q: QueueQuery) => QueueQuery;
  sources: PriceSource[];
  fetchCard: (card: WorkerCard, mappings: SourceMapping[]) => Promise<{
    observations: PriceObservation[];
    cardUpdates?: Record<string, unknown>;
  }>;
  sleepMs: number;
}

class SqlQueueQuery implements QueueQuery {
  private readonly clauses: string[] = [];
  private readonly params: string[] = [];

  ilike(column: string, pattern: string): QueueQuery {
    if (column !== 'slug') throw new Error(`Unsupported queue column: ${column}`);
    this.params.push(pattern);
    this.clauses.push(`c.slug ILIKE $${this.params.length}`);
    return this;
  }

  not(column: string, operator: string, value: string): QueueQuery {
    if (column !== 'slug' || operator !== 'ilike') {
      throw new Error(`Unsupported queue predicate: ${column} ${operator}`);
    }
    this.params.push(value);
    this.clauses.push(`c.slug NOT ILIKE $${this.params.length}`);
    return this;
  }

  toSql(): { where: string; params: string[] } {
    return {
      where: this.clauses.length > 0 ? this.clauses.join(' AND ') : 'TRUE',
      params: this.params,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A dead or overloaded database (Cloudflare 522s, pooler timeouts, network resets) must not
// exhaust PM2's max_restarts and permanently kill the fleet — back off in-process instead.
// Structural errors (42P10, bad payloads) still throw so PM2 restarts loudly.
const TRANSIENT_DB_ERROR = /timeout|timed out|522|fetch failed|econnreset|econnrefused|socket|network|closed before|terminated/i;

export function isTransientDbError(error: unknown): boolean {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error);
  return TRANSIENT_DB_ERROR.test(message);
}

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_CAP_MS = 300_000;

function backoffDelay(consecutiveFailures: number): number {
  return Math.min(BACKOFF_BASE_MS * 3 ** Math.max(0, consecutiveFailures - 1), BACKOFF_CAP_MS);
}

function updateFailure(card: WorkerCard, operation: string, error: unknown): never {
  const detail = error && typeof error === 'object' && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error);
  throw new Error(`[price-engine] ${card.slug}: ${operation} failed: ${detail}`);
}

export async function runScrapeLoop(config: WorkerConfig): Promise<never> {
  const label = `[${config.label}]`;
  // Coolify injects SOURCE_COMMIT; BUILD_SHA is the manual override for other hosts.
  console.log(`${label} boot build=${process.env.BUILD_SHA ?? process.env.SOURCE_COMMIT ?? 'dev'} node=${process.version}`);
  const db = createScraperClient();

  let previousCardId: string | null = null;
  let consecutiveDbFailures = 0;

  while (true) {
    if (previousCardId) {
      await revalidateCardPage(previousCardId, `${label} [fence]`);
      previousCardId = null;
    }

    const queue = config.queueFilter(new SqlQueueQuery());
    const queueSql = queue.toSql();
    let cards: unknown[];
    try {
      cards = await db(
        `SELECT c.id, c.name, c.slug, c.number, c.tcg_player_id, c.print_run_info,
                c.yuyutei_url, c.cardrush_url,
                CASE WHEN s.id IS NULL THEN NULL ELSE json_build_object('name', s.name) END AS sets
         FROM cards c
         LEFT JOIN sets s ON s.id = c.set_id
         WHERE ${queueSql.where}
         ORDER BY c.last_price_fetch ASC NULLS FIRST
         LIMIT 1`,
        queueSql.params,
      ) as unknown[];
    } catch (error) {
      if (!isTransientDbError(error)) throw error;

      consecutiveDbFailures++;
      const delay = backoffDelay(consecutiveDbFailures);
      console.error(`${label} Failed to fetch queue (failure #${consecutiveDbFailures}, backing off ${delay / 1000}s)`, error);
      await sleep(delay);
      continue;
    }

    if (cards.length === 0) {
      await sleep(config.sleepMs);
      continue;
    }

    const card = cards[0] as WorkerCard;
    console.log(`${label} Processing: ${card.name} (${card.number})`);

    try {
      const mappings = (await getMappingsForCard(db, card.id)).filter((mapping) => (
        config.sources.includes(mapping.source)
        && (mapping.confidence === 'confirmed' || mapping.confidence === 'derived')
      ));
      const result = await config.fetchCard(card, mappings);
      if (result.observations.length === 0) {
        const timestamp = new Date().toISOString();
        try {
          await db(
            `UPDATE cards SET last_price_fetch = $1 WHERE id = $2`,
            [timestamp, card.id],
          );
        } catch (cardError) {
          updateFailure(card, 'cards empty-result update', cardError);
        }
        if (mappings.length === 0) {
          console.log(`${label} no confident mapping, skipped`);
        } else {
          console.log(`${label} No prices found from any source, skipping... written=0 quarantined=0`);
        }
      } else {
        console.log(`${label} Successfully fetched ${result.observations.length} price points.`);
        const persisted = await persistObservations(
          db,
          card,
          result.observations,
          result.cardUpdates,
          mappings,
        );
        console.log(`${label} Price persistence for ${card.slug}: written=${persisted.written} quarantined=${persisted.quarantined}`);
        await revalidateCardPage(card.id, label);
        previousCardId = card.id;
      }
      consecutiveDbFailures = 0;
    } catch (cardError) {
      if (!isTransientDbError(cardError)) throw cardError;
      consecutiveDbFailures++;
      const delay = backoffDelay(consecutiveDbFailures);
      // last_price_fetch was not advanced on the failing path, so the card stays at the
      // front of the queue and is retried after the backoff — no burned queue entries.
      console.error(`${label} Transient DB failure on ${card.slug} (failure #${consecutiveDbFailures}, backing off ${delay / 1000}s)`, cardError);
      await sleep(delay);
      continue;
    }

    console.log(`${label} Sleeping for ${config.sleepMs / 1000}s... Zzz...\n`);
    await sleep(config.sleepMs);
  }
}
