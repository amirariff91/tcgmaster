import { Metadata } from 'next';
import { MarketClient } from './market-client';

export const metadata: Metadata = {
  title: 'Market Movers | TCGMaster',
  description:
    'Track the top gainers and losers in the TCG market. Real-time price movements across Pokemon, Basketball, and Baseball cards.',
  openGraph: {
    title: 'Market Movers | TCGMaster',
    description:
      'Track the top gainers and losers in the TCG market. Real-time price movements across Pokemon, Basketball, and Baseball cards.',
    type: 'website',
    siteName: 'TCGMaster',
  },
  other: {
    'application/ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Market Movers',
      description: 'Track the top gainers and losers in the TCG market',
      mainEntity: {
        '@type': 'ItemList',
        name: 'Top Market Movers',
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
      },
    }),
  },
};

// ISR revalidation every 1 hour
export const revalidate = 3600;

export default function MarketPage() {
  return <MarketClient />;
}
