import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeGrade, type CanonicalGrade } from '../pricing/grades';
import { assertIdentity, type MatchEvidence } from './identity';
import { checkSelfConsistency } from './guards';
import { markForReverification, type SourceMapping, upsertMapping } from './mapping';

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

export const SOURCE_SCOPED_UPDATE_COLUMNS: Record<string, PriceSource> = {
  tcg_player_id: 'tcgplayer',
  print_run_info: 'tcgplayer',
};

export interface PriceObservation {
  source: PriceSource;
  grade: CanonicalGrade;
  priceUsd: number;
  priceNative: number | null;
  currency: 'USD' | 'JPY';
  evidence: MatchEvidence;
  recordedAt?: string;
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

export interface CurrentSourcePrice {
  usd: number;
  native: number | null;
  currency: 'USD' | 'JPY';
  kind: PriceKind;
  recorded_at: string;
}

function isPriceSource(value: string): value is PriceSource {
  return Object.prototype.hasOwnProperty.call(SOURCE_KIND, value);
}

export function selectHeadlineFromSourcePrices(
  sourcePrices: Record<string, CurrentSourcePrice>,
): Headline | null {
  const candidates = Object.entries(sourcePrices).flatMap(([source, price]) => {
    if (!isPriceSource(source) || !Number.isFinite(price.usd)) return [];
    if (!HEADLINE_KIND_PREFERENCE.includes(price.kind)) return [];

    return [{ source, usd: price.usd, kind: price.kind }];
  });

  for (const kind of HEADLINE_KIND_PREFERENCE) {
    const kindCandidates = candidates.filter((candidate) => candidate.kind === kind);
    if (kindCandidates.length === 0) continue;

    const winner = kindCandidates.reduce((lowest, candidate) => (
      candidate.usd < lowest.usd ? candidate : lowest
    ));

    return {
      cents: Math.round(winner.usd * 100),
      source: winner.source,
      kind,
      grade: 'raw',
    };
  }

  return null;
}

export interface CurrentPriceRow {
  card_id: string;
  source_prices: Record<string, CurrentSourcePrice>;
  graded_prices: GradedPrices;
  headline_cents: number | null;
  headline_source: PriceSource | null;
  headline_kind: PriceKind | null;
  headline_currency: 'USD' | 'JPY' | null;
  headline_grade: CanonicalGrade | null;
  computed_at: string;
}

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

function mergeGradedPrices(existing: GradedPrices, fresh: GradedPrices): GradedPrices {
  const merged: GradedPrices = { ...existing };

  for (const [grade, freshGrade] of Object.entries(fresh)) {
    const existingGrade = existing[grade];
    const sources = {
      ...(existingGrade?.sources ?? {}),
      ...freshGrade.sources,
    };
    const values = Object.values(sources);

    merged[grade] = {
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      sources,
    };
  }

  return merged;
}

export function shapeCurrentRow(
  cardId: string,
  acceptedObs: PriceObservation[],
  headline: Headline | null,
  recordedAt: string,
): CurrentPriceRow {
  const sourcePrices: Record<string, CurrentSourcePrice> = {};

  for (const observation of acceptedObs) {
    if (observation.grade !== 'raw' || !Number.isFinite(observation.priceUsd)) continue;

    sourcePrices[observation.source] = {
      usd: observation.priceUsd,
      native: observation.priceNative,
      currency: observation.currency,
      kind: SOURCE_KIND[observation.source],
      recorded_at: observation.recordedAt ?? recordedAt,
    };
  }

  return {
    card_id: cardId,
    source_prices: sourcePrices,
    graded_prices: shapeGradedPrices(acceptedObs),
    headline_cents: headline?.cents ?? null,
    headline_source: headline?.source ?? null,
    headline_kind: headline?.kind ?? null,
    headline_currency: headline ? SOURCE_CURRENCY[headline.source] : null,
    headline_grade: headline?.grade ?? null,
    computed_at: recordedAt,
  };
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

function quarantineEvidence(
  card: CardRef,
  observation: PriceObservation,
  details: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    expected: { number: card.number, name: card.name },
    expectedNumber: card.number,
    matched: observation.evidence ?? null,
    ...(observation.evidence ?? {}),
    ...details,
  };
}

function normalizeSetForDrift(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasSetDrift(
  observation: PriceObservation,
  mapping: SourceMapping | undefined,
): boolean {
  const storedSet = mapping?.externalSet?.trim();
  const fetchedSet = observation.evidence?.externalSet?.trim();
  if (!storedSet || !fetchedSet) return false;

  return normalizeSetForDrift(storedSet) !== normalizeSetForDrift(fetchedSet);
}

export async function persistObservations(
  db: SupabaseClient,
  card: CardRef,
  obs: PriceObservation[],
  extraUpdates: Record<string, unknown> = {},
  mappings: SourceMapping[] = [],
): Promise<PersistResult> {
  const now = new Date();
  const recordedAt = now.toISOString();
  const acceptedObservations: PriceObservation[] = [];
  const quarantineRows: Record<string, unknown>[] = [];
  const mappingsBySource = new Map(mappings.map((mapping) => [mapping.source, mapping]));
  const identityVerdicts = obs.map((observation) => (
    assertIdentity({ number: card.number, name: card.name }, observation.evidence)
  ));
  const identityApprovedObservations = obs.filter((observation, index) => (
    identityVerdicts[index]?.ok === true
    && observation.evidence.inStock !== false
    && !hasSetDrift(observation, mappingsBySource.get(observation.source))
  ));

  for (const [index, observation] of obs.entries()) {
    const mapping = mappingsBySource.get(observation.source);
    if (hasSetDrift(observation, mapping)) {
      quarantineRows.push({
        card_id: card.id,
        source: observation.source,
        grade: normalizeGrade(observation.grade),
        price: observation.priceUsd,
        price_native: observation.priceNative,
        currency: observation.currency,
        price_kind: SOURCE_KIND[observation.source],
        reason: 'title-drift',
        evidence: quarantineEvidence(card, observation, {
          storedExternalSet: mapping?.externalSet,
        }),
      });
      try {
        await markForReverification(db, card.id, observation.source);
      } catch (error) {
        console.error(`[price-engine] ${card.slug}: failed to mark ${observation.source} for reverification`, error);
      }
      continue;
    }

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

    if (mapping && mapping.externalTitle === null) {
      try {
        await upsertMapping(db, {
          ...mapping,
          externalTitle: observation.evidence.externalTitle ?? null,
          externalSet: observation.evidence.externalSet ?? mapping.externalSet,
          verifiedAt: new Date().toISOString(),
        }, { force: true });
      } catch (error) {
        console.error(`[price-engine] ${card.slug}: failed to backfill ${observation.source} mapping evidence`, error);
      }
    }

    acceptedObservations.push(observation);
  }

  const batchHeadline = selectHeadline(acceptedObservations);
  const freshCurrentRow = shapeCurrentRow(card.id, acceptedObservations, batchHeadline, recordedAt);

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

  const { data: existingCache, error: cacheReadError } = await db
    .from('price_cache')
    .select('ebay_sales, source')
    .eq('card_id', card.id)
    .maybeSingle();
  throwIfError(card, 'price_cache select', cacheReadError);

  const cachePayload = {
    card_id: card.id,
    variant_id: null,
    raw_prices: shapeRawPrices(acceptedObservations, batchHeadline),
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

  const acceptedSources = new Set(acceptedObservations.map((observation) => observation.source));
  const scopedExtraUpdates = Object.fromEntries(
    Object.entries(extraUpdates).filter(([column]) => {
      const source = SOURCE_SCOPED_UPDATE_COLUMNS[column];
      return !source || acceptedSources.has(source);
    }),
  );

  const { data: existingCurrent, error: currentReadError } = await db
    .from('card_price_current')
    .select('source_prices, graded_prices')
    .eq('card_id', card.id)
    .maybeSingle();
  throwIfError(card, 'card_price_current select', currentReadError);

  const existingCurrentRow = existingCurrent as Pick<CurrentPriceRow, 'source_prices' | 'graded_prices'> | null;
  const mergedSourcePrices = {
    ...(existingCurrentRow?.source_prices ?? {}),
    ...freshCurrentRow.source_prices,
  };
  const mergedGradedPrices = mergeGradedPrices(
    existingCurrentRow?.graded_prices ?? {},
    freshCurrentRow.graded_prices,
  );
  const headline = selectHeadlineFromSourcePrices(mergedSourcePrices);
  const currentRow: CurrentPriceRow = {
    ...freshCurrentRow,
    source_prices: mergedSourcePrices,
    graded_prices: mergedGradedPrices,
    headline_cents: headline?.cents ?? null,
    headline_source: headline?.source ?? null,
    headline_kind: headline?.kind ?? null,
    headline_currency: headline ? SOURCE_CURRENCY[headline.source] : null,
    headline_grade: headline?.grade ?? null,
  };

  const { error: currentError } = await db
    .from('card_price_current')
    .upsert(currentRow, { onConflict: 'card_id' });
  throwIfError(card, 'card_price_current upsert', currentError);

  const { error: cardError } = await db
    .from('cards')
    .update({
      ...scopedExtraUpdates,
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
