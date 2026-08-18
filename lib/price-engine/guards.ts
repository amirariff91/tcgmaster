import type { PgQuery } from './db';

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
  db: PgQuery,
  input: ConsistencyInput,
  corroborating: number[],
): Promise<ConsistencyVerdict> {
  let rows: Array<{ price: unknown }>;
  try {
    rows = await db(
      `SELECT price
       FROM price_history
       WHERE card_id = $1 AND source = $2 AND grade = $3
       ORDER BY recorded_at DESC
       LIMIT 5`,
      [input.cardId, input.source, input.grade],
    ) as Array<{ price: unknown }>;
  } catch (error) {
    throw new Error(`[price-engine] price_history consistency read failed: ${String(error instanceof Error ? error.message : error)}`);
  }

  const historyPrices = rows
    .map((row) => Number(row.price))
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
