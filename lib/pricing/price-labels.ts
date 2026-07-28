export type PriceKind =
  | 'market'
  | 'lowest_listing'
  | 'retail_sell'
  | 'sold_guide'
  | 'marketplace_ask';

const PRICE_KIND_LABELS: Record<PriceKind, string> = {
  market: 'Market',
  retail_sell: 'Retail (JP)',
  sold_guide: 'Sold guide',
  lowest_listing: 'Lowest listing',
  marketplace_ask: 'Ask',
};

export function priceKindLabel(kind: PriceKind | null | undefined): string {
  return kind ? PRICE_KIND_LABELS[kind] ?? 'Price' : 'Price';
}

export function latestRecordedAt(sourcePrices: unknown): string | null {
  let latest: string | null = null;
  let latestTime = -Infinity;

  if (!sourcePrices || typeof sourcePrices !== 'object' || Array.isArray(sourcePrices)) {
    return null;
  }

  for (const value of Object.values(sourcePrices)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    const recordedAt = (value as { recorded_at?: unknown }).recorded_at;
    if (typeof recordedAt !== 'string') continue;

    const recordedTime = Date.parse(recordedAt);
    if (!Number.isFinite(recordedTime) || recordedTime <= latestTime) continue;

    latest = recordedAt;
    latestTime = recordedTime;
  }

  return latest;
}
