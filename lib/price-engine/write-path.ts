import type { PgQuery } from './db';
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

async function queryDb<T>(
  db: PgQuery,
  card: CardRef,
  operation: string,
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  try {
    return await db(text, params) as T[];
  } catch (error) {
    writeFailure(card, operation, error);
  }
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
  db: PgQuery,
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

  if (quarantineRows.length > 0) {
    await queryDb(
      db,
      card,
      'price_quarantine insert',
      `INSERT INTO price_quarantine (
         card_id, source, grade, price, price_native, currency, price_kind, reason, evidence
       )
       SELECT card_id, source, grade, price, price_native, currency, price_kind, reason, evidence
       FROM jsonb_to_recordset($1::jsonb) AS rows(
         card_id uuid,
         source price_source,
         grade text,
         price numeric,
         price_native numeric,
         currency text,
         price_kind price_kind,
         reason text,
         evidence jsonb
       )`,
      [JSON.stringify(quarantineRows)],
    );
  }

  if (historyRows.length > 0) {
    const recentCutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const recentRows = await queryDb<{ source: unknown; grade: unknown; price: unknown }>(
      db,
      card,
      'price_history recent-row select',
      `SELECT source, grade, price
       FROM price_history
       WHERE card_id = $1 AND recorded_at >= $2`,
      [card.id, recentCutoff],
    );

    const recentKeys = new Set(recentRows.map((recent) => {
      return [String(recent.source), String(recent.grade), Number(recent.price)].join('\u0000');
    }));
    const unsuppressedHistoryRows = historyRows.filter((row) => (
      !recentKeys.has([row.source, row.grade, row.price].join('\u0000'))
    ));
    const suppressedCount = historyRows.length - unsuppressedHistoryRows.length;
    console.log(`[price-engine] ${card.slug}: suppressed ${suppressedCount} duplicate price_history rows`);
    historyRows = unsuppressedHistoryRows;

    if (historyRows.length > 0) {
      // price_history is append-only. Corrections are represented by new observations;
      // this statement intentionally has no UPDATE or DELETE path.
      await queryDb(
        db,
        card,
        'price_history insert',
        `INSERT INTO price_history (
           card_id, price, source, grade, price_native, currency, price_kind, recorded_at
         )
         SELECT card_id, price, source, grade, price_native, currency, price_kind, recorded_at
         FROM jsonb_to_recordset($1::jsonb) AS rows(
           card_id uuid,
           price numeric,
           source price_source,
           grade text,
           price_native numeric,
           currency text,
           price_kind price_kind,
           recorded_at timestamptz
         )`,
        [JSON.stringify(historyRows)],
      );
    }
  }

  const acceptedSources = new Set(acceptedObservations.map((observation) => observation.source));
  const scopedExtraUpdates = Object.fromEntries(
    Object.entries(extraUpdates).filter(([column]) => {
      const source = SOURCE_SCOPED_UPDATE_COLUMNS[column];
      return !source || acceptedSources.has(source);
    }),
  );

  const currentRows = await queryDb<Pick<CurrentPriceRow, 'source_prices' | 'graded_prices'>>(
    db,
    card,
    'card_price_current select',
    `SELECT source_prices, graded_prices
     FROM card_price_current
     WHERE card_id = $1
     LIMIT 1`,
    [card.id],
  );

  const existingCurrentRow = currentRows[0] ?? null;
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

  await queryDb(
    db,
    card,
    'card_price_current upsert',
    `INSERT INTO card_price_current (
       card_id, source_prices, graded_prices, headline_cents, headline_source,
       headline_kind, headline_currency, headline_grade, computed_at
     )
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (card_id) DO UPDATE SET
       source_prices = EXCLUDED.source_prices,
       graded_prices = EXCLUDED.graded_prices,
       headline_cents = EXCLUDED.headline_cents,
       headline_source = EXCLUDED.headline_source,
       headline_kind = EXCLUDED.headline_kind,
       headline_currency = EXCLUDED.headline_currency,
       headline_grade = EXCLUDED.headline_grade,
       computed_at = EXCLUDED.computed_at`,
    [
      currentRow.card_id,
      JSON.stringify(currentRow.source_prices),
      JSON.stringify(currentRow.graded_prices),
      currentRow.headline_cents,
      currentRow.headline_source,
      currentRow.headline_kind,
      currentRow.headline_currency,
      currentRow.headline_grade,
      currentRow.computed_at,
    ],
  );

  const cardUpdates: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(scopedExtraUpdates)) {
    if (value === undefined) continue;
    if (!Object.prototype.hasOwnProperty.call(SOURCE_SCOPED_UPDATE_COLUMNS, column)) continue;
    cardUpdates[column] = value;
  }
  const cardUpdateEntries = Object.entries(cardUpdates);
  const cardSetClauses = cardUpdateEntries.map(([column], index) => (
    `${column} = $${index + 2}`
  ));
  cardSetClauses.push(`last_price_fetch = $${cardUpdateEntries.length + 2}`);
  const cardParams = [
    card.id,
    ...cardUpdateEntries.map(([, value]) => (
      typeof value === 'object' && value !== null ? JSON.stringify(value) : value
    )),
    recordedAt,
  ];

  await queryDb(
    db,
    card,
    'cards update',
    `UPDATE cards
     SET ${cardSetClauses.join(', ')}
     WHERE id = $1`,
    cardParams,
  );

  return {
    written: acceptedObservations.length,
    quarantined: quarantineRows.length,
    historyRows: historyRows.length,
    headline,
  };
}
