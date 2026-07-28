import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConsistencyInput {
  cardId: string;
  source: string;
  grade: string;
  priceUsd: number;
}

export type ConsistencyVerdict =
  | { ok: true }
  | { ok: false; median: number; ratio: number };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function ratioBetween(left: number, right: number): number {
  if (left === 0 && right === 0) return 1;
  if (left === 0 || right === 0) return Number.POSITIVE_INFINITY;
  return Math.max(left / right, right / left);
}

export async function checkSelfConsistency(
  db: SupabaseClient,
  input: ConsistencyInput,
  corroborating: number[],
): Promise<ConsistencyVerdict> {
  const { data, error } = await db
    .from('price_history')
    .select('price')
    .eq('card_id', input.cardId)
    .eq('source', input.source)
    .eq('grade', input.grade)
    .order('recorded_at', { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`[price-engine] price_history consistency read failed: ${String(error.message ?? error)}`);
  }

  const historyPrices = (data ?? [])
    .map((row) => Number((row as { price: unknown }).price))
    .filter((price) => Number.isFinite(price));

  if (historyPrices.length < 3) return { ok: true };

  const trailingMedian = median(historyPrices);
  const ratio = ratioBetween(input.priceUsd, trailingMedian);

  const hasCorroboration = corroborating.some((price) => (
    Number.isFinite(price) && ratioBetween(input.priceUsd, price) <= 2
  ));
  // Eight times the trailing median is the catastrophe boundary (wrong-product matches
  // land at 30-100x); anything under it passes uncorroborated, because 69% of the
  // catalogue is single-source and real chase-card moves of 3-5x must not quarantine.
  if (ratio <= 8 || hasCorroboration) return { ok: true };
  return { ok: false, median: trailingMedian, ratio };
}
