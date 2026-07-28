import type { SupabaseClient } from '@supabase/supabase-js';
import { createScraperClient } from './db';
import { revalidateCardPage } from './revalidate';
import { persistObservations, type CardRef, type PriceObservation } from './write-path';

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
  order(column: string, options: { ascending: boolean; nullsFirst: boolean }): QueueQuery;
  limit(count: number): Promise<{ data: unknown[] | null; error: unknown }>;
}

export interface WorkerConfig {
  label: string;
  queueFilter: (q: QueueQuery) => QueueQuery;
  fetchCard: (card: WorkerCard) => Promise<{
    observations: PriceObservation[];
    cardUpdates?: Record<string, unknown>;
  }>;
  sleepMs: number;
}

const CARD_SELECT = 'id, name, slug, number, tcg_player_id, print_run_info, yuyutei_url, cardrush_url, sets ( name )';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateFailure(card: WorkerCard, operation: string, error: unknown): never {
  const detail = error && typeof error === 'object' && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error);
  throw new Error(`[price-engine] ${card.slug}: ${operation} failed: ${detail}`);
}

export async function runScrapeLoop(config: WorkerConfig): Promise<never> {
  const label = `[${config.label}]`;
  console.log(`${label} boot build=${process.env.BUILD_SHA ?? 'dev'} node=${process.version}`);
  const db: SupabaseClient = createScraperClient();

  let previousCardId: string | null = null;

  while (true) {
    if (previousCardId) {
      await revalidateCardPage(previousCardId, `${label} [fence]`);
      previousCardId = null;
    }

    const queue = config.queueFilter(db.from('cards').select(CARD_SELECT) as unknown as QueueQuery);
    const { data: cards, error } = await queue
      .order('last_price_fetch', { ascending: true, nullsFirst: true })
      .limit(1);

    if (error || !cards || cards.length === 0) {
      console.error(`${label} Failed to fetch queue`, error);
      await sleep(config.sleepMs);
      continue;
    }

    const card = cards[0] as WorkerCard;
    console.log(`${label} Processing: ${card.name} (${card.number})`);

    const result = await config.fetchCard(card);
    if (result.observations.length === 0) {
      const timestamp = new Date().toISOString();
      const { error: cardError } = await db
        .from('cards')
        .update({ last_price_fetch: timestamp })
        .eq('id', card.id);
      if (cardError) updateFailure(card, 'cards empty-result update', cardError);
      console.log(`${label} No prices found from any source, skipping...`);
    } else {
      console.log(`${label} Successfully fetched ${result.observations.length} price points.`);
      await persistObservations(db, card, result.observations, result.cardUpdates);
      await revalidateCardPage(card.id, label);
      previousCardId = card.id;
    }

    console.log(`${label} Sleeping for ${config.sleepMs / 1000}s... Zzz...\n`);
    await sleep(config.sleepMs);
  }
}
