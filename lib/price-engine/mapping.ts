import type { SupabaseClient } from '@supabase/supabase-js';
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
  db: SupabaseClient,
  cardId: string,
  source: PriceSource,
): Promise<SourceMapping | null> {
  const { data, error } = await db
    .from('card_source_mapping')
    .select('*')
    .eq('card_id', cardId)
    .eq('source', source)
    .maybeSingle();
  if (error) throw new Error(`getMapping(${cardId}, ${source}): ${error.message}`);
  return data ? fromRow(data as MappingRow) : null;
}

export async function getMappingsForCard(
  db: SupabaseClient,
  cardId: string,
): Promise<SourceMapping[]> {
  const { data, error } = await db
    .from('card_source_mapping')
    .select('*')
    .eq('card_id', cardId);
  if (error) throw new Error(`getMappingsForCard(${cardId}): ${error.message}`);
  return ((data ?? []) as MappingRow[]).map(fromRow);
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
  db: SupabaseClient,
  mapping: SourceMapping,
  opts: { force?: boolean } = {},
): Promise<UpsertResult> {
  if (!opts.force && mapping.confidence !== 'confirmed') {
    const existing = await getMapping(db, mapping.cardId, mapping.source);
    if (existing?.confidence === 'confirmed') {
      return { mapping: existing, written: false };
    }
  }
  const { data, error } = await db
    .from('card_source_mapping')
    .upsert(toRow(mapping), { onConflict: 'card_id,source' })
    .select()
    .single();
  if (error) throw new Error(`upsertMapping(${mapping.cardId}, ${mapping.source}): ${error.message}`);
  return { mapping: fromRow(data as MappingRow), written: true };
}

/** Evidence drifted: null verified_at so the resolver revisits this pair. */
export async function markForReverification(
  db: SupabaseClient,
  cardId: string,
  source: PriceSource,
): Promise<void> {
  const { error } = await db
    .from('card_source_mapping')
    .update({ verified_at: null, updated_at: new Date().toISOString() })
    .eq('card_id', cardId)
    .eq('source', source);
  if (error) throw new Error(`markForReverification(${cardId}, ${source}): ${error.message}`);
}

/** One query per resolver run: qualifier → meaning for a (game, source) pair. */
export async function loadQualifierMap(
  db: SupabaseClient,
  game: string,
  source: PriceSource,
): Promise<Map<string, QualifierMeaning>> {
  const { data, error } = await db
    .from('source_qualifiers')
    .select('qualifier, means')
    .eq('game', game)
    .eq('source', source);
  if (error) throw new Error(`loadQualifierMap(${game}, ${source}): ${error.message}`);
  return new Map(
    ((data ?? []) as { qualifier: string; means: QualifierMeaning }[]).map((r) => [
      r.qualifier.toLowerCase(),
      r.means,
    ]),
  );
}
