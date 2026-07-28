import { createScraperClient } from '../../lib/price-engine/db';
import {
  selectHeadline,
  shapeCurrentRow,
  SOURCE_CURRENCY,
  type CurrentPriceRow,
  type PriceObservation,
  type PriceSource,
} from '../../lib/price-engine/write-path';
import { normalizeGrade, type CanonicalGrade } from '../../lib/pricing/grades';

const CARD_BATCH_SIZE = 500;
const HISTORY_PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 500;
const SUPPORTED_SOURCES: readonly Exclude<PriceSource, 'snkrdunk'>[] = [
  'tcgplayer',
  'pricecharting',
  'yuyutei',
  'cardrush',
];

type BackfillSource = Exclude<PriceSource, 'snkrdunk'>;

type Card = {
  id: string;
  slug: string;
};

type HistoryRow = {
  card_id: string;
  price: number | string;
  price_native: number | string | null;
  currency: string | null;
  source: string;
  grade: string | number | null;
  recorded_at: string;
};

type BackfillObservation = PriceObservation & {
  source: BackfillSource;
  grade: CanonicalGrade;
  recordedAt: string;
};

type NewestHistory = {
  cardsWithHistory: Set<string>;
  rows: Map<string, BackfillObservation>;
};

type Totals = {
  totalCards: number;
  cardsWithHeadline: number;
  sourceCounts: Record<BackfillSource, number>;
  samples: {
    slug: string;
    headlineCents: number | null;
    headlineSource: PriceSource | null;
    headlineKind: string | null;
  }[];
};

function parseArgs(args: string[]): { dryRun: boolean; limit: number | null } {
  const dryRun = args.includes('--dry-run');
  const limitIndex = args.indexOf('--limit');
  const inlineLimit = args.find((arg) => arg.startsWith('--limit='));
  const rawLimit = limitIndex >= 0 ? args[limitIndex + 1] : inlineLimit?.slice('--limit='.length);

  if (rawLimit === undefined) return { dryRun, limit: null };

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('--limit must be a positive integer');
  }

  return { dryRun, limit };
}

function isBackfillSource(source: string): source is BackfillSource {
  return (SUPPORTED_SOURCES as readonly string[]).includes(source);
}

function normalizeHistoryRow(row: HistoryRow): BackfillObservation | null {
  if (!isBackfillSource(row.source)) return null;

  const priceUsd = Number(row.price);
  if (!Number.isFinite(priceUsd)) return null;

  const recordedAt = new Date(row.recorded_at);
  if (!Number.isFinite(recordedAt.getTime())) return null;

  let priceNative: number | null = null;
  if (row.price_native !== null && row.price_native !== undefined && row.price_native !== '') {
    const native = Number(row.price_native);
    if (Number.isFinite(native)) priceNative = native;
  }

  const currency = row.currency === 'USD' || row.currency === 'JPY'
    ? row.currency
    : SOURCE_CURRENCY[row.source];

  return {
    source: row.source,
    grade: normalizeGrade(row.grade),
    priceUsd,
    priceNative,
    currency,
    evidence: { matchedBy: 'dictionary' },
    recordedAt: row.recorded_at,
  };
}

async function loadCardPage(
  db: ReturnType<typeof createScraperClient>,
  offset: number,
): Promise<Card[]> {
  const { data, error } = await db
    .from('cards')
    .select('id, slug')
    .order('id', { ascending: true })
    .range(offset, offset + CARD_BATCH_SIZE - 1);

  if (error) throw new Error(`Loading cards for current-price backfill failed: ${error.message}`);
  return (data ?? []) as Card[];
}

async function loadNewestHistory(
  db: ReturnType<typeof createScraperClient>,
  cards: Card[],
): Promise<NewestHistory> {
  const cardIds = cards.map((card) => card.id);
  const cardIdSet = new Set(cardIds);
  const cardsWithHistory = new Set<string>();
  const rows = new Map<string, BackfillObservation>();

  for (let offset = 0; ; offset += HISTORY_PAGE_SIZE) {
    const { data, error } = await db
      .from('price_history')
      .select('card_id, price, price_native, currency, source, grade, recorded_at')
      .in('card_id', cardIds)
      .order('recorded_at', { ascending: false })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1);

    if (error) throw new Error(`Loading price_history for current-price backfill failed: ${error.message}`);
    const page = (data ?? []) as HistoryRow[];

    for (const row of page) {
      if (!cardIdSet.has(row.card_id)) continue;
      cardsWithHistory.add(row.card_id);

      const observation = normalizeHistoryRow(row);
      if (!observation) continue;

      const key = `${row.card_id}\u0000${observation.source}\u0000${observation.grade}`;
      const previous = rows.get(key);
      if (!previous || new Date(observation.recordedAt).getTime() > new Date(previous.recordedAt).getTime()) {
        rows.set(key, observation);
      }
    }

    if (page.length < HISTORY_PAGE_SIZE) break;
  }

  return { cardsWithHistory, rows };
}

function emptyTotals(): Totals {
  return {
    totalCards: 0,
    cardsWithHeadline: 0,
    sourceCounts: Object.fromEntries(SUPPORTED_SOURCES.map((source) => [source, 0])) as Record<BackfillSource, number>,
    samples: [],
  };
}

function rowsForCard(
  card: Card,
  newestHistory: NewestHistory,
  computedAt: string,
): CurrentPriceRow {
  const observations: BackfillObservation[] = [];
  for (const [key, observation] of newestHistory.rows) {
    if (key.startsWith(`${card.id}\u0000`)) observations.push(observation);
  }

  const headline = selectHeadline(observations);
  return shapeCurrentRow(card.id, observations, headline, computedAt);
}

async function writeRows(
  db: ReturnType<typeof createScraperClient>,
  rows: CurrentPriceRow[],
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += WRITE_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + WRITE_BATCH_SIZE);
    const { error } = await db
      .from('card_price_current')
      .upsert(batch, { onConflict: 'card_id' });

    if (error) {
      throw new Error(`Writing card_price_current rows (${offset}-${offset + batch.length - 1}) failed: ${error.message}`);
    }
  }
}

function addTotals(totals: Totals, card: Card, row: CurrentPriceRow): void {
  totals.totalCards++;
  if (row.headline_cents !== null) totals.cardsWithHeadline++;

  for (const source of Object.keys(row.source_prices) as BackfillSource[]) {
    totals.sourceCounts[source]++;
  }

  if (totals.samples.length < 5) {
    totals.samples.push({
      slug: card.slug,
      headlineCents: row.headline_cents,
      headlineSource: row.headline_source,
      headlineKind: row.headline_kind,
    });
  }
}

function reportTotals(totals: Totals, dryRun: boolean): void {
  console.log(`card_price_current backfill${dryRun ? ' (dry-run)' : ''}`);
  console.log(`total cards: ${totals.totalCards}`);
  console.log(`cards with non-null headline: ${totals.cardsWithHeadline}`);
  console.log('per-source counts:');
  for (const source of SUPPORTED_SOURCES) {
    console.log(`  ${source}: ${totals.sourceCounts[source]}`);
  }
  console.log('sample rows:');
  for (const sample of totals.samples) {
    console.log(`  ${sample.slug}\t${sample.headlineCents ?? 'null'}\t${sample.headlineSource ?? 'null'}\t${sample.headlineKind ?? 'null'}`);
  }
}

async function main(): Promise<void> {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));
  const db = createScraperClient();
  const totals = emptyTotals();
  let cardOffset = 0;
  let reachedLimit = false;

  while (!reachedLimit) {
    const cards = await loadCardPage(db, cardOffset);
    if (cards.length === 0) break;
    cardOffset += cards.length;

    const newestHistory = await loadNewestHistory(db, cards);
    const rows: CurrentPriceRow[] = [];

    for (const card of cards) {
      if (!newestHistory.cardsWithHistory.has(card.id)) continue;
      if (limit !== null && totals.totalCards >= limit) {
        reachedLimit = true;
        break;
      }

      const row = rowsForCard(card, newestHistory, new Date().toISOString());
      rows.push(row);
      addTotals(totals, card, row);
    }

    if (!dryRun && rows.length > 0) {
      await writeRows(db, rows);
      console.log(`[backfill] processed ${totals.totalCards} cards`);
    }

    if (cards.length < CARD_BATCH_SIZE) break;
  }

  reportTotals(totals, dryRun);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
