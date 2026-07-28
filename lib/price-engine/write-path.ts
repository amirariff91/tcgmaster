import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeGrade, type CanonicalGrade } from '../pricing/grades';
import { assertIdentity, type MatchEvidence } from './identity';
import { checkSelfConsistency } from './guards';

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
  evidence: MatchEvidence;
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
  written: number;
  quarantined: number;
  historyRows: number;
  headline: Headline | null;
}

const URL_UPDATE_SOURCES: Record<string, PriceSource> = {
  tcgplayer_url: 'tcgplayer',
  yuyutei_url: 'yuyutei',
  cardrush_url: 'cardrush',
  snkrdunk_url: 'snkrdunk',
};

function quarantineEvidence(
  card: CardRef,
  observation: PriceObservation,
  details: Record<string, number> = {},
): Record<string, unknown> {
  return {
    expected: { number: card.number, name: card.name },
    expectedNumber: card.number,
    matched: observation.evidence ?? null,
    ...(observation.evidence ?? {}),
    ...details,
  };
}

export async function persistObservations(
  db: SupabaseClient,
  card: CardRef,
  obs: PriceObservation[],
  extraUpdates: Record<string, unknown> = {},
): Promise<PersistResult> {
  const now = new Date();
  const recordedAt = now.toISOString();
  const acceptedObservations: PriceObservation[] = [];
  const quarantineRows: Record<string, unknown>[] = [];
  const identityVerdicts = obs.map((observation) => (
    assertIdentity({ number: card.number, name: card.name }, observation.evidence)
  ));
  const identityApprovedObservations = obs.filter((observation, index) => (
    identityVerdicts[index]?.ok === true && observation.evidence.inStock !== false
  ));

  for (const [index, observation] of obs.entries()) {
    const identity = identityVerdicts[index];
    if (!identity.ok) {
      quarantineRows.push({
        card_id: card.id,
        source: observation.source,
        grade: normalizeGrade(observation.grade),
        price: observation.priceUsd,
        price_native: observation.priceNative,
        currency: observation.currency,
        price_kind: SOURCE_KIND[observation.source],
        reason: identity.reason,
        evidence: quarantineEvidence(card, observation),
      });
      continue;
    }

    const corroborating = identityApprovedObservations
      .filter((other) => (
        other !== observation
        && other.source !== observation.source
        && other.grade === observation.grade
      ))
      .map((other) => other.priceUsd);
    const consistency = await checkSelfConsistency(db, {
      cardId: card.id,
      source: observation.source,
      grade: normalizeGrade(observation.grade),
      priceUsd: observation.priceUsd,
    }, corroborating);

    if (!consistency.ok) {
      quarantineRows.push({
        card_id: card.id,
        source: observation.source,
        grade: normalizeGrade(observation.grade),
        price: observation.priceUsd,
        price_native: observation.priceNative,
        currency: observation.currency,
        price_kind: SOURCE_KIND[observation.source],
        reason: 'ratio-vs-median',
        evidence: quarantineEvidence(card, observation, {
          median: consistency.median,
          ratio: consistency.ratio,
        }),
      });
      continue;
    }

    acceptedObservations.push(observation);
  }

  const headline = selectHeadline(acceptedObservations);

  let historyRows = acceptedObservations.map((observation) => ({
    card_id: card.id,
    price: observation.priceUsd,
    source: observation.source,
    grade: normalizeGrade(observation.grade),
    price_native: observation.priceNative,
    currency: observation.currency,
    price_kind: SOURCE_KIND[observation.source],
    recorded_at: recordedAt,
  }));

  const safeUpdates = { ...extraUpdates };
  for (const [column, source] of Object.entries(URL_UPDATE_SOURCES)) {
    if (column in safeUpdates && !acceptedObservations.some((observation) => observation.source === source)) {
      delete safeUpdates[column];
    }
  }

  const { data: existingCache, error: cacheReadError } = await db
    .from('price_cache')
    .select('ebay_sales, source')
    .eq('card_id', card.id)
    .maybeSingle();
  throwIfError(card, 'price_cache select', cacheReadError);

  const cachePayload = {
    card_id: card.id,
    variant_id: null,
    raw_prices: shapeRawPrices(acceptedObservations, headline),
    graded_prices: shapeGradedPrices(acceptedObservations),
    fetched_at: recordedAt,
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    ...(existingCache?.ebay_sales !== undefined ? { ebay_sales: existingCache.ebay_sales } : {}),
    ...(existingCache?.source !== undefined ? { source: existingCache.source } : {}),
  };

  const { error: deleteError } = await db.from('price_cache').delete().eq('card_id', card.id);
  throwIfError(card, 'price_cache delete', deleteError);

  const { error: cacheError } = await db.from('price_cache').insert(cachePayload);
  throwIfError(card, 'price_cache insert', cacheError);

  if (quarantineRows.length > 0) {
    const { error } = await db.from('price_quarantine').insert(quarantineRows);
    throwIfError(card, 'price_quarantine insert', error);
  }

  if (historyRows.length > 0) {
    const recentCutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const { data: recentRows, error: recentRowsError } = await db
      .from('price_history')
      .select('source, grade, price')
      .eq('card_id', card.id)
      .gte('recorded_at', recentCutoff);
    throwIfError(card, 'price_history recent-row select', recentRowsError);

    const recentKeys = new Set((recentRows ?? []).map((row) => {
      const recent = row as { source: unknown; grade: unknown; price: unknown };
      return [String(recent.source), String(recent.grade), Number(recent.price)].join('\u0000');
    }));
    const unsuppressedHistoryRows = historyRows.filter((row) => (
      !recentKeys.has([row.source, row.grade, row.price].join('\u0000'))
    ));
    const suppressedCount = historyRows.length - unsuppressedHistoryRows.length;
    console.log(`[price-engine] ${card.slug}: suppressed ${suppressedCount} duplicate price_history rows`);
    historyRows = unsuppressedHistoryRows;

    if (historyRows.length > 0) {
      const { error } = await db.from('price_history').insert(historyRows);
      throwIfError(card, 'price_history insert', error);
    }
  }

  const { error: cardError } = await db
    .from('cards')
    .update({
      ...safeUpdates,
      price_cache_ttl: headline ? headline.cents : null,
      last_price_fetch: recordedAt,
    })
    .eq('id', card.id);
  throwIfError(card, 'cards update', cardError);

  return {
    written: acceptedObservations.length,
    quarantined: quarantineRows.length,
    historyRows: historyRows.length,
    headline,
  };
}
