import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSetBySlug, getRelatedSets, mockSets } from '@/lib/mock-data';
import { SetPageClient } from './set-page-client';

interface SetPageProps {
  params: Promise<{
    game: string;
    set: string;
  }>;
  searchParams: Promise<{
    q?: string;
    sort?: string;
  }>;
}

// Generate static params for ISR
export async function generateStaticParams() {
  const params: { game: string; set: string }[] = [];

  Object.values(mockSets).forEach((set) => {
    params.push({
      game: set.gameSlug,
      set: set.slug,
    });
  });

  return params;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: SetPageProps): Promise<Metadata> {
  const { game, set: setSlug } = await params;
  const setData = getSetBySlug(game, setSlug);

  if (!setData) {
    return {
      title: 'Set Not Found | TCGMaster',
    };
  }

  const title = `${setData.name} - ${setData.game} Cards | TCGMaster`;
  const description = `Complete price guide for ${setData.name} (${setData.game}). Track prices for ${setData.card_count} cards including Raw and PSA graded values.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'TCGMaster',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    other: {
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${setData.name} - ${setData.game} Cards`,
        description,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: setData.card_count,
          itemListElement: setData.cards.slice(0, 10).map((card, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'Product',
              name: `${card.name} - ${setData.name}`,
              offers: card.prices.raw
                ? {
                    '@type': 'AggregateOffer',
                    lowPrice: card.prices.raw,
                    highPrice: card.prices.psa10,
                    priceCurrency: 'USD',
                  }
                : undefined,
            },
          })),
        },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: setData.game,
              item: `https://tcgmaster.com/${game}`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: setData.name,
              item: `https://tcgmaster.com/${game}/${setSlug}`,
            },
          ],
        },
      }),
    },
  };
}

// ISR revalidation every 1 hour
export const revalidate = 3600;

export default async function SetPage({ params, searchParams }: SetPageProps) {
  const { game, set: setSlug } = await params;
  const { q, sort } = await searchParams;

  const setData = getSetBySlug(game, setSlug);

  if (!setData) {
    notFound();
  }

  const relatedSets = getRelatedSets(setSlug);

  return (
    <SetPageClient
      setData={setData}
      relatedSets={relatedSets}
      gameSlug={game}
      initialQuery={q}
      initialSort={sort}
    />
  );
}
