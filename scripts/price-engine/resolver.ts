import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createScraperClient } from '../../lib/price-engine/db';
import {
  loadQualifierMap,
  upsertMapping,
  type QualifierMeaning,
  type SourceMapping,
} from '../../lib/price-engine/mapping';
import { type MatchEvidence } from '../../lib/price-engine/identity';
import {
  classifyCandidate,
  selectPriceChartingCandidate,
} from '../../lib/price-engine/resolver-logic';
import { fetchCardrushPrice } from '../../lib/price-engine/cardrush';
import { searchPriceChartingCandidates } from '../../lib/price-engine/pricecharting';
import { fetchEnglishPrice } from '../../lib/price-engine/tcgcsv';
import { fetchJapanesePrice } from '../../lib/price-engine/yuyutei';
import type { PriceSource } from '../../lib/price-engine/write-path';

const PAGE_SIZE = 1000;
const DEFAULT_LIMIT = 1000;
const EMPTY_QUEUE_SLEEP_MS = 10 * 60 * 1000;
const DEFAULT_SLEEP_MS = 20_000;
const DB_BACKOFF_BASE_MS = 5_000;
const DB_BACKOFF_CAP_MS = 300_000;
const DB_ERROR_PATTERN = /timeout|timed out|522|fetch failed|econnreset|econnrefused|socket|network|closed before|terminated/i;
const DBFW_TCGPLAYER_CATEGORY_ID = 80;

type ResolverSource = 'pricecharting' | 'tcgplayer' | 'yuyutei' | 'cardrush';
type Game = 'op' | 'dbfw';

type ResolverCard = {
  id: string;
  name: string | null;
  slug: string;
  number: string;
  tcg_player_id?: string | null;
  yuyutei_url?: string | null;
  cardrush_url?: string | null;
  sets?: { name?: string | null } | null;
};

type DbClient = ReturnType<typeof createScraperClient>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error);
}

function isTransientDbError(error: unknown): boolean {
  return DB_ERROR_PATTERN.test(errorMessage(error));
}

function backoffDelay(consecutiveFailures: number): number {
  return Math.min(
    DB_BACKOFF_BASE_MS * 3 ** Math.max(0, consecutiveFailures - 1),
    DB_BACKOFF_CAP_MS,
  );
}

async function withDbBackoff<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let consecutiveFailures = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientDbError(error)) throw error;

      consecutiveFailures++;
      const delay = backoffDelay(consecutiveFailures);
      console.error(`${label} transient DB failure #${consecutiveFailures}; backing off ${delay / 1000}s`, error);
      await sleep(delay);
    }
  }
}

function parsePositiveInteger(raw: string | undefined, flag: string, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
}

function parseArgs(): {
  source: ResolverSource;
  game?: Game;
  limit: number;
  loop: boolean;
} {
  const sourceIndex = process.argv.indexOf('--source');
  const source = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : undefined;
  if (source !== 'pricecharting' && source !== 'tcgplayer' && source !== 'yuyutei' && source !== 'cardrush') {
    throw new Error('Usage: bun run scripts/price-engine/resolver.ts --source pricecharting|tcgplayer|yuyutei|cardrush [--game op|dbfw] [--limit N] [--loop]');
  }

  const gameIndex = process.argv.indexOf('--game');
  const rawGame = gameIndex >= 0 ? process.argv[gameIndex + 1] : undefined;
  if (rawGame !== undefined && rawGame !== 'op' && rawGame !== 'dbfw') {
    throw new Error('--game must be op or dbfw');
  }

  const limitIndex = process.argv.indexOf('--limit');
  const rawLimit = limitIndex >= 0 ? process.argv[limitIndex + 1] : undefined;
  return {
    source,
    game: rawGame as Game | undefined,
    limit: parsePositiveInteger(rawLimit, '--limit', DEFAULT_LIMIT),
    loop: process.argv.includes('--loop'),
  };
}

function gameForSlug(slug: string): Game | undefined {
  const prefix = slug.toLowerCase().split('-')[0];
  return prefix === 'op' || prefix === 'dbfw' ? prefix : undefined;
}

function pairKey(cardId: string, source: ResolverSource): string {
  return `${cardId}|${source}`;
}

async function loadMappedCardIds(db: DbClient, source: ResolverSource): Promise<Set<string>> {
  return withDbBackoff(`[resolver:${source}] mapping query`, async () => {
    const cardIds = new Set<string>();

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await db
        .from('card_source_mapping')
        .select('card_id')
        .eq('source', source)
        .order('card_id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw new Error(`Loading mapped card IDs: ${error.message}`);
      const page = (data ?? []) as { card_id: string }[];
      for (const row of page) cardIds.add(row.card_id);
      if (page.length < PAGE_SIZE) break;
    }

    return cardIds;
  });
}

function applyCandidateFilters(query: any, source: ResolverSource, game?: Game): any {
  let filtered = query;

  if (source === 'yuyutei') {
    filtered = filtered.ilike('slug', 'op-%').ilike('slug', '%-ja');
  } else if (source === 'cardrush') {
    filtered = filtered.ilike('slug', 'dbfw-%').ilike('slug', '%-ja');
  } else if (source === 'tcgplayer') {
    filtered = filtered
      .or('slug.ilike.op-%,slug.ilike.dbfw-%')
      .not('slug', 'ilike', '%-ja');
  } else if (source === 'pricecharting') {
    filtered = filtered.or('slug.ilike.op-%,slug.ilike.dbfw-%');
  }

  if (game) filtered = filtered.ilike('slug', `${game}-%`);
  return filtered;
}

async function loadCandidates(
  db: DbClient,
  source: ResolverSource,
  game: Game | undefined,
  limit: number,
  mappedCardIds: Set<string>,
  skippedThisRun: Set<string>,
): Promise<ResolverCard[]> {
  return withDbBackoff(`[resolver:${source}] candidate query`, async () => {
    const cards: ResolverCard[] = [];
    let excludedPreviouslySkipped = 0;

    // Exclude locally after ordered pages rather than putting thousands of UUIDs into
    // a PostgREST `not in (...)` URL once a source has broad coverage.
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const query = applyCandidateFilters(
        db.from('cards').select('id, name, slug, number, tcg_player_id, yuyutei_url, cardrush_url, sets ( name )'),
        source,
        game,
      );
      const { data, error } = await query
        .order('slug', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw new Error(`Loading resolver candidates: ${error.message}`);
      const page = (data ?? []) as ResolverCard[];
      for (const card of page) {
        if (mappedCardIds.has(card.id)) continue;
        if (skippedThisRun.has(card.id)) {
          excludedPreviouslySkipped++;
          continue;
        }
        cards.push(card);
        if (cards.length >= limit) {
          console.log(`RESOLVER-SKIPPED-EXCLUDED ${source} ${excludedPreviouslySkipped}`);
          return cards;
        }
      }
      if (page.length < PAGE_SIZE) break;
    }

    console.log(`RESOLVER-SKIPPED-EXCLUDED ${source} ${excludedPreviouslySkipped}`);
    return cards;
  });
}

async function loadQualifierMaps(
  db: DbClient,
  source: ResolverSource,
  game?: Game,
): Promise<Map<Game, Map<string, QualifierMeaning>>> {
  const games: Game[] = game ? [game] : ['op', 'dbfw'];
  const maps = new Map<Game, Map<string, QualifierMeaning>>();

  for (const currentGame of games) {
    const qualifierMap = await withDbBackoff(
      `[resolver:${source}] qualifier query (${currentGame})`,
      () => loadQualifierMap(db, currentGame, source),
    );
    maps.set(currentGame, qualifierMap);
  }

  return maps;
}

function resolverQuery(source: ResolverSource, card: ResolverCard): string {
  if (source === 'pricecharting') {
    return card.slug.toLowerCase().endsWith('-ja') ? `${card.number} japanese` : card.number;
  }
  return card.number;
}

async function fetchCandidateEvidence(
  source: ResolverSource,
  card: ResolverCard,
): Promise<{ evidence: MatchEvidence; query: string } | null> {
  const query = resolverQuery(source, card);

  if (source === 'tcgplayer') {
    const game = gameForSlug(card.slug);
    const categoryId = game === 'dbfw' ? DBFW_TCGPLAYER_CATEGORY_ID : undefined;
    const result = await fetchEnglishPrice(card.number, card.sets?.name ?? undefined, undefined, categoryId);
    return result ? { evidence: result.evidence, query } : null;
  }

  if (source === 'yuyutei') {
    const result = await fetchJapanesePrice(query);
    return result ? { evidence: result.evidence, query } : null;
  }

  const result = await fetchCardrushPrice(query);
  return result ? { evidence: result.evidence, query } : null;
}

function mappingFromEvidence(
  card: ResolverCard,
  source: ResolverSource,
  evidence: MatchEvidence,
  confidence: SourceMapping['confidence'],
  query: string,
  externalSet?: string,
): SourceMapping {
  return {
    cardId: card.id,
    source,
    externalId: evidence.externalId ?? null,
    externalUrl: evidence.externalUrl ?? null,
    externalTitle: evidence.externalTitle ?? null,
    externalSet: externalSet ?? evidence.externalSet ?? null,
    confidence,
    matchedBy: 'number-token',
    evidence: { resolvedBy: 'resolver', query },
    verifiedAt: new Date().toISOString(),
  };
}

type Resolution = {
  action: 'accept' | 'reject' | 'skip' | 'nomatch';
  reason: string;
  mapping?: SourceMapping;
  unknownQualifierReasons: string[];
};

function resolverCardForClassification(card: ResolverCard): {
  number: string;
  slug: string;
  name?: string;
} {
  return {
    number: card.number,
    slug: card.slug,
    name: card.name ?? undefined,
  };
}

async function resolveCard(
  source: ResolverSource,
  card: ResolverCard,
  qualifierMaps: Map<Game, Map<string, QualifierMeaning>>,
): Promise<Resolution> {
  const query = resolverQuery(source, card);
  const cardGame = gameForSlug(card.slug);
  const qualifierMap = cardGame ? qualifierMaps.get(cardGame) : undefined;
  const classificationCard = resolverCardForClassification(card);

  if (source === 'pricecharting') {
    const candidates = await searchPriceChartingCandidates(query);
    const selection = selectPriceChartingCandidate({
      card: classificationCard,
      candidates,
      qualifierMap: qualifierMap ?? new Map(),
    });

    if (selection.candidate && selection.classification) {
      const evidence: MatchEvidence = {
        externalTitle: selection.candidate.title,
        externalUrl: selection.candidate.url,
        matchedBy: 'search',
      };
      const confidence = selection.action === 'accept' ? 'derived' : 'rejected';
      return {
        action: selection.action,
        reason: selection.reason,
        mapping: mappingFromEvidence(
          card,
          source,
          evidence,
          confidence,
          query,
          selection.classification.externalSet,
        ),
        unknownQualifierReasons: [],
      };
    }

    return {
      action: selection.action,
      reason: selection.reason,
      unknownQualifierReasons: selection.unknownQualifierReasons,
    };
  }

  const result = await fetchCandidateEvidence(source, card);
  if (!result) {
    return { action: 'nomatch', reason: 'no-candidate', unknownQualifierReasons: [] };
  }

  const classification = classifyCandidate({
    card: classificationCard,
    evidence: result.evidence,
    qualifierMap: qualifierMap ?? new Map(),
    source,
  });
  if (classification.action === 'skip') {
    return {
      action: 'skip',
      reason: classification.reason,
      unknownQualifierReasons: classification.reason.startsWith('unknown-qualifier:')
        ? [classification.reason]
        : [],
    };
  }

  const confidence = classification.action === 'accept' ? 'derived' : 'rejected';
  return {
    action: classification.action,
    reason: classification.reason,
    mapping: mappingFromEvidence(
      card,
      source,
      result.evidence,
      confidence,
      result.query,
      classification.externalSet,
    ),
    unknownQualifierReasons: [],
  };
}

function recordUnknownQualifier(reason: string, tally: Map<string, number>): void {
  const prefix = 'unknown-qualifier:';
  if (!reason.startsWith(prefix)) return;
  const token = reason.slice(prefix.length);
  tally.set(token, (tally.get(token) ?? 0) + 1);
}

function reportUnknownQualifierTally(tally: Map<string, number>): void {
  if (tally.size === 0) {
    console.log('RESOLVER-UNKNOWN-QUALIFIER-TALLY none');
    return;
  }

  for (const [token, count] of [...tally.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    console.log(`RESOLVER-UNKNOWN-QUALIFIER-TALLY ${token} ${count}`);
  }
}

type ResolverMappingRow = {
  card_id: string;
  source: ResolverSource;
  external_id: string | null;
  external_url: string | null;
  external_title: string | null;
  external_set: string | null;
  confidence: SourceMapping['confidence'];
  matched_by: SourceMapping['matchedBy'];
  evidence: Record<string, unknown> | null;
  verified_at: string | null;
};

function mappingFromRow(row: ResolverMappingRow): SourceMapping {
  return {
    cardId: row.card_id,
    source: row.source,
    externalId: row.external_id,
    externalUrl: row.external_url,
    externalTitle: row.external_title,
    externalSet: row.external_set,
    confidence: row.confidence,
    matchedBy: row.matched_by,
    evidence: row.evidence,
    verifiedAt: row.verified_at,
  };
}

async function loadReverificationMappings(
  db: DbClient,
  source: ResolverSource,
): Promise<SourceMapping[]> {
  return withDbBackoff(`[resolver:${source}] reverification query`, async () => {
    const mappings: SourceMapping[] = [];

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await db
        .from('card_source_mapping')
        .select('*')
        .eq('source', source)
        .filter('evidence->>reverify', 'eq', 'true')
        .order('card_id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw new Error(`Loading reverification mappings: ${error.message}`);
      const page = (data ?? []) as ResolverMappingRow[];
      mappings.push(...page.map(mappingFromRow));
      if (page.length < PAGE_SIZE) break;
    }

    return mappings;
  });
}

async function loadCardById(db: DbClient, cardId: string): Promise<ResolverCard | null> {
  return withDbBackoff('[resolver] reverification card query', async () => {
    const { data, error } = await db
      .from('cards')
      .select('id, name, slug, number, tcg_player_id, yuyutei_url, cardrush_url, sets ( name )')
      .eq('id', cardId)
      .maybeSingle();

    if (error) throw new Error(`Loading reverification card ${cardId}: ${error.message}`);
    return data ? data as ResolverCard : null;
  });
}

async function processCard(
  db: DbClient,
  source: ResolverSource,
  card: ResolverCard,
  force: boolean,
  isReverification: boolean,
  qualifierMaps: Map<Game, Map<string, QualifierMeaning>>,
  skippedThisRun: Set<string>,
  unknownQualifierTally: Map<string, number>,
): Promise<void> {
  const resolution = await resolveCard(source, card, qualifierMaps);
  for (const reason of resolution.unknownQualifierReasons) {
    recordUnknownQualifier(reason, unknownQualifierTally);
  }

  if (resolution.mapping) {
    await withDbBackoff(
      `[resolver:${source}] mapping write (${card.slug})`,
      () => upsertMapping(db, resolution.mapping!, { force }),
    );
    if (isReverification) {
      console.log(`RESOLVER-REVERIFY ${card.slug} ${source} ${resolution.action.toUpperCase()} ${resolution.reason}`);
    } else {
      console.log(`RESOLVER-${resolution.action.toUpperCase()} ${card.slug} ${source} ${resolution.reason}`);
    }
    return;
  }

  if (resolution.action === 'skip') {
    skippedThisRun.add(card.id);
    if (isReverification) {
      console.log(`RESOLVER-REVERIFY ${card.slug} ${source} SKIP ${resolution.reason}`);
    } else {
      console.log(`RESOLVER-SKIP ${card.slug} ${source} ${resolution.reason}`);
    }
    return;
  }

  skippedThisRun.add(card.id);
  if (isReverification) {
    console.log(`RESOLVER-REVERIFY ${card.slug} ${source} NOMATCH`);
  } else {
    console.log(`RESOLVER-NOMATCH ${card.slug} ${source}`);
  }
}

async function runPass(
  db: DbClient,
  source: ResolverSource,
  game: Game | undefined,
  limit: number,
  sleepMs: number,
  qualifierMaps: Map<Game, Map<string, QualifierMeaning>>,
  skippedThisRun: Set<string>,
): Promise<number> {
  const unknownQualifierTally = new Map<string, number>();
  const reverificationMappings = await loadReverificationMappings(db, source);
  let processed = 0;

  for (const mapping of reverificationMappings) {
    const card = await loadCardById(db, mapping.cardId);
    if (!card) {
      console.log(`RESOLVER-REVERIFY ${mapping.cardId} ${source} MISSING-CARD`);
      continue;
    }

    await processCard(
      db,
      source,
      card,
      true,
      true,
      qualifierMaps,
      skippedThisRun,
      unknownQualifierTally,
    );
    processed++;
  }

  const mappedCardIds = await loadMappedCardIds(db, source);
  const cards = await loadCandidates(db, source, game, limit, mappedCardIds, skippedThisRun);

  for (let index = 0; index < cards.length; index++) {
    await processCard(
      db,
      source,
      cards[index],
      false,
      false,
      qualifierMaps,
      skippedThisRun,
      unknownQualifierTally,
    );
    processed++;

    if (index < cards.length - 1) await sleep(sleepMs);
  }

  reportUnknownQualifierTally(unknownQualifierTally);
  return processed;
}

function sleepMsFromEnvironment(): number {
  const raw = process.env.RESOLVER_SLEEP_MS;
  if (raw === undefined) return DEFAULT_SLEEP_MS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_SLEEP_MS;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const db = createScraperClient();
  const sleepMs = sleepMsFromEnvironment();
  const qualifierMaps = await loadQualifierMaps(db, args.source, args.game);
  const skippedThisRun = new Set<string>();

  while (true) {
    const processed = await runPass(
      db,
      args.source,
      args.game,
      args.limit,
      sleepMs,
      qualifierMaps,
      skippedThisRun,
    );

    if (!args.loop) return;
    if (processed === 0) {
      skippedThisRun.clear();
      console.log(`RESOLVER-EMPTY ${args.source}; sleeping ${EMPTY_QUEUE_SLEEP_MS / 1000}s`);
      await sleep(EMPTY_QUEUE_SLEEP_MS);
    }
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
