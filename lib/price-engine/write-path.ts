import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeGrade, type CanonicalGrade } from '../pricing/grades';

export type PriceSource = 'tcgplayer' | 'pricecharting' | 'yuyutei' | 'cardrush' | 'snkrdunk';
export type PriceKind = 'market' | 'lowest_listing' | 'retail_sell' | 'sold_guide' | 'marketplace_ask';

export const SOURCE_KIND: Record<PriceSource, PriceKind> = {
  tcgplayer: 'market',
  pricecharting: 'sold_guide',
  yuyutei: 'retail_sell',
  cardrush: 'lowest_listing',
  snkrdunk: 'marketplace_ask',
};

export const SOURCE_CURRENCY: Record<PriceSource, 'USD' | 'JPY'> = {
  tcgplayer: 'USD',
  pricecharting: 'USD',
  yuyutei: 'JPY',
  cardrush: 'JPY',
  snkrdunk: 'USD',
};

export interface PriceObservation {
  source: PriceSource;
  grade: CanonicalGrade;
  priceUsd: number;
  priceNative: number | null;
  currency: 'USD' | 'JPY';
}

export interface CardRef {
  id: string;
  slug: string;
  number: string;
  name: string;
}

export interface Headline {
  cents: number;
  source: PriceSource;
  kind: PriceKind;
  grade: CanonicalGrade;
}

// Headline policy: raw market first, then retail sell, sold guide, and lowest
// listing. Marketplace asks are intentionally excluded because an ask is not a
// market-clearing price.
const HEADLINE_KIND_PREFERENCE: PriceKind[] = [
  'market',
  'retail_sell',
  'sold_guide',
  'lowest_listing',
];

export function selectHeadline(obs: PriceObservation[]): Headline | null {
  const rawObservations = obs.filter(
    (observation) => observation.grade === 'raw' && Number.isFinite(observation.priceUsd),
  );

  for (const kind of HEADLINE_KIND_PREFERENCE) {
    const candidates = rawObservations.filter((observation) => SOURCE_KIND[observation.source] === kind);
    if (candidates.length === 0) continue;

    const winner = candidates.reduce((lowest, observation) =>
      observation.priceUsd < lowest.priceUsd ? observation : lowest,
    );

    return {
      cents: Math.round(winner.priceUsd * 100),
      source: winner.source,
      kind,
      grade: 'raw',
    };
  }

  return null;
}

export interface GradedPrice {
  average: number;
  sources: Record<string, number>;
}

export type GradedPrices = Record<string, GradedPrice>;

export function shapeGradedPrices(obs: PriceObservation[]): GradedPrices {
  const grouped = new Map<CanonicalGrade, PriceObservation[]>();

  for (const observation of obs) {
    if (observation.grade === 'raw' || !Number.isFinite(observation.priceUsd)) continue;

    const grade = normalizeGrade(observation.grade);
    const group = grouped.get(grade) ?? [];
    group.push(observation);
    grouped.set(grade, group);
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([grade, observations]) => {
      const sources: Record<string, number> = {};
      for (const observation of observations) {
        sources[observation.source] = observation.priceUsd;
      }

      const average = observations.reduce((sum, observation) => sum + observation.priceUsd, 0) / observations.length;
      return [grade, { average, sources }];
    }),
  );
}

function writeFailure(card: CardRef, operation: string, error: unknown): never {
  const detail = error && typeof error === 'object' && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error);
  throw new Error(`[price-engine] ${card.slug}: ${operation} failed: ${detail}`);
}

function throwIfError(card: CardRef, operation: string, error: unknown): void {
  if (error) writeFailure(card, operation, error);
}

function shapeRawPrices(obs: PriceObservation[], headline: Headline | null): Record<string, number> {
  const rawPrices: Record<string, number> = {};

  for (const observation of obs) {
    if (observation.grade === 'raw' && Number.isFinite(observation.priceUsd)) {
      rawPrices[observation.source] = observation.priceUsd;
    }
  }

  if (headline) {
    rawPrices.market = headline.cents / 100;
  }

  return rawPrices;
}

export interface PersistResult {
  historyRows: number;
  headline: Headline | null;
}

export async function persistObservations(
  db: SupabaseClient,
  card: CardRef,
  obs: PriceObservation[],
  extraUpdates: Record<string, unknown> = {},
): Promise<PersistResult> {
  const now = new Date();
  const recordedAt = now.toISOString();
  const headline = selectHeadline(obs);

  const historyRows = obs.map((observation) => ({
    card_id: card.id,
    price: observation.priceUsd,
    source: observation.source,
    grade: normalizeGrade(observation.grade),
    price_native: observation.priceNative,
    currency: observation.currency,
    price_kind: SOURCE_KIND[observation.source],
    recorded_at: recordedAt,
  }));

  if (historyRows.length > 0) {
    const { error } = await db.from('price_history').insert(historyRows);
    throwIfError(card, 'price_history insert', error);
  }

  const { error: deleteError } = await db.from('price_cache').delete().eq('card_id', card.id);
  throwIfError(card, 'price_cache delete', deleteError);

  const { error: cacheError } = await db.from('price_cache').insert({
    card_id: card.id,
    variant_id: null,
    raw_prices: shapeRawPrices(obs, headline),
    graded_prices: shapeGradedPrices(obs),
    fetched_at: recordedAt,
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  });
  throwIfError(card, 'price_cache insert', cacheError);

  const { error: cardError } = await db
    .from('cards')
    .update({
      ...extraUpdates,
      price_cache_ttl: headline ? headline.cents : null,
      last_price_fetch: recordedAt,
    })
    .eq('id', card.id);
  throwIfError(card, 'cards update', cardError);

  return { historyRows: historyRows.length, headline };
}
