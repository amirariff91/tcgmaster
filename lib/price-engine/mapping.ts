import type { PgQuery } from './db';
import type { PriceSource } from './write-path';

export type MappingConfidence = 'confirmed' | 'derived' | 'rejected';
export type MatchedBy = 'dictionary' | 'product-id' | 'number-token' | 'url' | 'manual';
export type QualifierMeaning = 'base_printing' | 'distinct_printing';

export interface SourceMapping {
  cardId: string;
  source: PriceSource;
  externalId: string | null;
  externalUrl: string | null;
  externalTitle: string | null;
  externalSet: string | null;
  confidence: MappingConfidence;
  matchedBy: MatchedBy;
  evidence: Record<string, unknown> | null;
  verifiedAt: string | null;
}

interface MappingRow {
  card_id: string;
  source: PriceSource;
  external_id: string | null;
  external_url: string | null;
  external_title: string | null;
  external_set: string | null;
  confidence: MappingConfidence;
  matched_by: MatchedBy;
  evidence: Record<string, unknown> | null;
  verified_at: string | null;
}

function fromRow(row: MappingRow): SourceMapping {
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

function toRow(mapping: SourceMapping): MappingRow & { updated_at: string } {
  return {
    card_id: mapping.cardId,
    source: mapping.source,
    external_id: mapping.externalId,
    external_url: mapping.externalUrl,
    external_title: mapping.externalTitle,
    external_set: mapping.externalSet,
    confidence: mapping.confidence,
    matched_by: mapping.matchedBy,
    evidence: mapping.evidence,
    verified_at: mapping.verifiedAt,
    updated_at: new Date().toISOString(),
  };
}

export async function getMapping(
  db: PgQuery,
  cardId: string,
  source: PriceSource,
): Promise<SourceMapping | null> {
  try {
    const rows = await db(
      `SELECT *
       FROM card_source_mapping
       WHERE card_id = $1 AND source = $2
       LIMIT 1`,
      [cardId, source],
    ) as MappingRow[];
    return rows[0] ? fromRow(rows[0]) : null;
  } catch (error) {
    throw new Error(`getMapping(${cardId}, ${source}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getMappingsForCard(
  db: PgQuery,
  cardId: string,
): Promise<SourceMapping[]> {
  try {
    const rows = await db(
      `SELECT *
       FROM card_source_mapping
       WHERE card_id = $1`,
      [cardId],
    ) as MappingRow[];
    return rows.map(fromRow);
  } catch (error) {
    throw new Error(`getMappingsForCard(${cardId}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface UpsertResult {
  mapping: SourceMapping;
  written: boolean;
}

/**
 * Upsert on (card_id, source). A stored `confirmed` mapping is never downgraded
 * by a `derived`/`rejected` write unless `force` is set (manual corrections) —
 * seed re-runs and resolver passes stay idempotent and non-destructive.
 */
export async function upsertMapping(
  db: PgQuery,
  mapping: SourceMapping,
  opts: { force?: boolean } = {},
): Promise<UpsertResult> {
  if (!opts.force && mapping.confidence !== 'confirmed') {
    const existing = await getMapping(db, mapping.cardId, mapping.source);
    if (existing?.confidence === 'confirmed') {
      return { mapping: existing, written: false };
    }
  }
  const row = toRow(mapping);
  try {
    const rows = await db(
      `INSERT INTO card_source_mapping (
         card_id, source, external_id, external_url, external_title, external_set,
         confidence, matched_by, evidence, verified_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
       ON CONFLICT (card_id, source) DO UPDATE SET
         external_id = EXCLUDED.external_id,
         external_url = EXCLUDED.external_url,
         external_title = EXCLUDED.external_title,
         external_set = EXCLUDED.external_set,
         confidence = EXCLUDED.confidence,
         matched_by = EXCLUDED.matched_by,
         evidence = EXCLUDED.evidence,
         verified_at = EXCLUDED.verified_at,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        row.card_id,
        row.source,
        row.external_id,
        row.external_url,
        row.external_title,
        row.external_set,
        row.confidence,
        row.matched_by,
        row.evidence === null ? null : JSON.stringify(row.evidence),
        row.verified_at,
        row.updated_at,
      ],
    ) as MappingRow[];
    const written = rows[0];
    if (!written) throw new Error('mapping upsert returned no row');
    return { mapping: fromRow(written), written: true };
  } catch (error) {
    throw new Error(`upsertMapping(${mapping.cardId}, ${mapping.source}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Evidence drifted: null verified_at so the resolver revisits this pair. */
export async function markForReverification(
  db: PgQuery,
  cardId: string,
  source: PriceSource,
): Promise<void> {
  const existing = await getMapping(db, cardId, source);
  if (!existing) return;

  try {
    await db(
      `UPDATE card_source_mapping
       SET evidence = COALESCE(evidence, '{}'::jsonb) || $3::jsonb,
           verified_at = NULL,
           updated_at = $4
       WHERE card_id = $1 AND source = $2`,
      [cardId, source, JSON.stringify({ reverify: true }), new Date().toISOString()],
    );
  } catch (error) {
    throw new Error(`markForReverification(${cardId}, ${source}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** One query per resolver run: qualifier → meaning for a (game, source) pair. */
export async function loadQualifierMap(
  db: PgQuery,
  game: string,
  source: PriceSource,
): Promise<Map<string, QualifierMeaning>> {
  let rows: { qualifier: string; means: QualifierMeaning }[];
  try {
    rows = await db(
      `SELECT qualifier, means
       FROM source_qualifiers
       WHERE game = $1 AND source = $2`,
      [game, source],
    ) as { qualifier: string; means: QualifierMeaning }[];
  } catch (error) {
    throw new Error(`loadQualifierMap(${game}, ${source}): ${error instanceof Error ? error.message : String(error)}`);
  }
  return new Map(
    rows.map((r) => [
      r.qualifier.toLowerCase(),
      r.means,
    ]),
  );
}
