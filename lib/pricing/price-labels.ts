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
