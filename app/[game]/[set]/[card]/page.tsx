import Link from 'next/link';
import { Metadata } from 'next';
import { Bell, Plus, Share2, Info, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CardImage } from '@/components/card/card-image';
import { PriceDisplay } from '@/components/card/price-display';
import { PriceMatrix } from '@/components/card/price-matrix';
import { PriceLadder } from '@/components/card/price-ladder';
import { GradeSelector } from '@/components/card/grade-selector';
import { PriceChart } from '@/components/charts/price-chart';
import { formatPrice, formatNumber, getRarityDisplay, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import { getCardWithPrices } from '@/lib/ppt/service';

// Types for card data
interface CardDataSet {
  id: string;
  name: string;
  slug: string;
  release_date: string | null;
  card_count: number | null;
  games: {
    id: string;
    name: string;
    slug: string;
    display_name: string;
  };
}

interface GradedPriceData {
  average: number | null;
  median: number | null;
  low: number | null;
  high: number | null;
  count: number;
}

interface CardDataPriceCache {
  raw_prices: Record<string, number | null>;
  graded_prices: Record<string, GradedPriceData>;
  ebay_sales: Record<string, unknown>;
  fetched_at: string;
  expires_at: string;
}

interface CardDataPriceHistory {
  grade: string;
  price: number;
  recorded_at: string;
}

interface CardDataPopulation {
  grade: number;
  count: number;
  grading_company_id: string;
}

interface CardData {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity: string | null;
  artist: string | null;
  description: string | null;
  image_url: string | null;
  tcg_player_id: string | null;
  sets: CardDataSet;
  card_variants: { id: string; variant_type: string; name: string; slug: string }[];
  price_cache: CardDataPriceCache | CardDataPriceCache[] | null;
  price_history: CardDataPriceHistory[];
  population_reports: CardDataPopulation[];
}

// Fetch card data from database
async function getCardData(gameSlug: string, setSlug: string, cardSlug: string): Promise<CardData | null> {
  const supabase = await createClient();

  const { data: card, error } = await supabase
    .from('cards')
    .select(`
      id,
      name,
      slug,
      number,
      rarity,
      artist,
      description,
      image_url,
      tcg_player_id,
      sets!inner (
        id,
        name,
        slug,
        release_date,
        card_count,
        games!inner (
          id,
          name,
          slug,
          display_name
        )
      ),
      card_variants (
        id,
        variant_type,
        name,
        slug
      ),
      price_cache (
        raw_prices,
        graded_prices,
        ebay_sales,
        fetched_at,
        expires_at
      ),
      price_history (
        grade,
        price,
        recorded_at
      ),
      population_reports (
        grade,
        count,
        grading_company_id
      )
    `)
    .eq('slug', cardSlug)
    .eq('sets.slug', setSlug)
    .eq('sets.games.slug', gameSlug)
    .single();

  if (error || !card) {
    return null;
  }

  // Type assertion to handle Supabase's complex nested types
  return card as unknown as CardData;
}

interface PageProps {
  params: Promise<{
    game: string;
    set: string;
    card: string;
  }>;
}

export const revalidate = 300; // 5 min — price updates surface quickly

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { game, set, card: cardSlug } = await params;
  const cardData = await getCardData(game, set, cardSlug);

  const cardName = cardData?.name || cardSlug;
  const setName = cardData?.sets?.name || set;
  const priceCache = Array.isArray(cardData?.price_cache)
    ? cardData?.price_cache[0]
    : cardData?.price_cache;
  const gradedPrices = priceCache?.graded_prices || {};
  const psa10Price = gradedPrices?.psa10?.average ?? gradedPrices?.psa9?.average ?? null;
  const priceDescription = psa10Price
    ? `Current PSA comp reference: ${formatPrice(psa10Price)}.`
    : 'No verified market price is available yet.';

  return {
    title: `${cardName} - ${setName} Price Guide | TCGMaster`,
    description: `Check current ${cardName} prices from ${setName}. View PSA, BGS graded prices, population reports, and price history.`,
    openGraph: {
      title: `${cardName} - ${setName} | TCGMaster`,
      description: priceDescription,
    },
  };
}

export default async function CardDetailPage({ params }: PageProps) {
  const { game, set, card: cardSlug } = await params;

  // Fetch real card data from database
  const cardData = await getCardData(game, set, cardSlug);

  // If no card found, show not-found state
  if (!cardData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Card Not Found</h1>
        <p className="text-zinc-500 mb-6">
          No card matching <span className="font-mono text-zinc-700">{cardSlug}</span> was found in{' '}
          <span className="font-mono text-zinc-700">{set}</span>.
        </p>
        <Link href={`/${game}`} className="text-blue-600 hover:underline">
          ← Back to {game}
        </Link>
      </div>
    );
  }

  const setData = cardData.sets;
  const gameData = setData.games;

  const card = {
    id: cardData.id,
    name: cardData.name,
    slug: cardData.slug,
    number: cardData.number,
    rarity: cardData.rarity as 'common' | 'uncommon' | 'rare' | 'holo-rare' | 'ultra-rare' | 'secret-rare' | 'promo' | null,
    artist: cardData.artist,
    image_url: cardData.image_url,
    description: cardData.description,
    lore: null as string | null,
    set: {
      id: setData?.id || '',
      name: setData?.name || '',
      slug: setData?.slug || '',
      release_date: setData?.release_date || null,
      card_count: setData?.card_count || 0,
    },
    game: {
      id: gameData?.id || '',
      name: gameData?.name || '',
      slug: gameData?.slug || '',
      display_name: gameData?.display_name || '',
    },
  };

  // Extract price data — prefer DB cache, fall back to live PPT fetch
  const dbPriceCache = Array.isArray(cardData?.price_cache)
    ? cardData?.price_cache[0] || null
    : cardData?.price_cache || null;

  // If no DB cache and card has a TCGPlayer ID, fetch live from PPT
  let livePrices: { raw: Record<string, number | null>; graded: Record<string, GradedPriceData> } | null = null;
  const tcgPlayerId = cardData?.tcg_player_id;
  if (!dbPriceCache && tcgPlayerId) {
    try {
      const pptData = await getCardWithPrices(tcgPlayerId, { includeEbay: true });
      if (pptData) {
        livePrices = {
          raw: pptData.prices.raw as Record<string, number | null>,
          graded: pptData.prices.graded as Record<string, GradedPriceData>,
        };
      }
    } catch {
      // silently fall through — show empty state
    }
  }

  const rawPrices = {
    nearMint: dbPriceCache?.raw_prices?.nearMint ?? livePrices?.raw?.nearMint ?? null,
    lightlyPlayed: dbPriceCache?.raw_prices?.lightlyPlayed ?? livePrices?.raw?.lightlyPlayed ?? null,
    moderatelyPlayed: dbPriceCache?.raw_prices?.moderatelyPlayed ?? livePrices?.raw?.moderatelyPlayed ?? null,
    heavilyPlayed: dbPriceCache?.raw_prices?.heavilyPlayed ?? livePrices?.raw?.heavilyPlayed ?? null,
  };

  const defaultGradedPrices: Record<string, GradedPriceData> = {};

  const gradedPrices: Record<string, GradedPriceData> =
    dbPriceCache?.graded_prices ||
    livePrices?.graded ||
    defaultGradedPrices;

  // Check if data is stale
  const isStale = dbPriceCache?.expires_at ? new Date(dbPriceCache.expires_at) < new Date() : false;
  const lastUpdated = dbPriceCache?.fetched_at || null;
  // Extract population data
  const populationReports = cardData?.population_reports || [];
  const population: Record<string, number> = {};
  for (const pop of populationReports) {
    population[`psa-${pop.grade}`] = pop.count;
  }
  if (Object.keys(population).length === 0) {
    // no population data available
  }

  // Extract price history
  const priceHistoryData = cardData?.price_history || [];
  const priceHistory = priceHistoryData.length > 0
    ? priceHistoryData
        .filter(h => h.grade === '10' || h.grade === 'psa10')
        .map(h => ({ date: h.recorded_at.split('T')[0], price: h.price }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  // Build price ladder entries
  const priceLadderEntries = [
    { grade: 'raw' as const, grading_company: null, price: rawPrices.nearMint || 0, confidence: 'high' as const, last_sale_date: null, population: null },
    { grade: '7' as const, grading_company: 'psa' as const, price: gradedPrices.psa7?.average || 0, confidence: 'high' as const, last_sale_date: null, population: population['psa-7'] || null },
    { grade: '8' as const, grading_company: 'psa' as const, price: gradedPrices.psa8?.average || 0, confidence: 'high' as const, last_sale_date: null, population: population['psa-8'] || null },
    { grade: '9' as const, grading_company: 'psa' as const, price: gradedPrices.psa9?.average || 0, confidence: 'high' as const, last_sale_date: null, population: population['psa-9'] || null },
    { grade: '10' as const, grading_company: 'psa' as const, price: gradedPrices.psa10?.average || 0, confidence: 'medium' as const, last_sale_date: null, population: population['psa-10'] || null },
  ].filter(e => e.price > 0);

  const availableGrades = [
    { grade: 'raw' as const, grading_company: null, hasData: rawPrices.nearMint !== null },
    { grade: '7' as const, grading_company: 'psa' as const, hasData: !!gradedPrices.psa7?.average },
    { grade: '8' as const, grading_company: 'psa' as const, hasData: !!gradedPrices.psa8?.average },
    { grade: '9' as const, grading_company: 'psa' as const, hasData: !!gradedPrices.psa9?.average },
    { grade: '10' as const, grading_company: 'psa' as const, hasData: !!gradedPrices.psa10?.average },
  ].filter(g => g.hasData);

  // Featured price (PSA 10 or highest available)
  const featuredPrice = gradedPrices.psa10?.average ||
                        gradedPrices.psa9?.average ||
                        rawPrices.nearMint ||
                        null;

  return (
    <div className="min-h-screen pb-16 overflow-x-hidden">
      {/* Stale Data Banner */}
      {isStale && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="container py-2 flex items-center gap-2 text-sm text-amber-800">
            <Clock className="h-4 w-4" />
            <span>
              Price data may be stale.
              {lastUpdated && ` Last updated ${formatDate(lastUpdated)}.`}
            </span>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="border-b border-zinc-200 bg-zinc-50">
        <div className="container py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href={`/${game}`}
              className="text-zinc-500 hover:text-zinc-900"
            >
              {card.game.display_name}
            </Link>
            <span className="text-zinc-300">/</span>
            <Link
              href={`/${game}/${set}`}
              className="text-zinc-500 hover:text-zinc-900"
            >
              {card.set.name}
            </Link>
            <span className="text-zinc-300">/</span>
            <span className="font-medium text-zinc-900">{card.name}</span>
          </nav>
        </div>
      </div>

      <div className="container py-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Card Image */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <CardImage
                src={card.image_url}
                alt={card.name}
                size="hero"
                priority
                className="mx-auto max-w-xs sm:max-w-sm lg:max-w-full"
              />
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                  Add to Collection
                </Button>
                <Button variant="outline" size="icon-sm">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {card.rarity && <Badge variant="secondary">{getRarityDisplay(card.rarity)}</Badge>}
                    <Badge variant="outline">#{card.number.includes('/') ? card.number : `${card.number}/${card.set.card_count}`}</Badge>
                  </div>
                  <h1 className="text-3xl font-bold text-zinc-900 md:text-4xl">
                    {card.name}
                  </h1>
                  <p className="mt-1 text-lg text-zinc-500">
                    {card.set.name} ({card.set.release_date?.slice(0, 4)})
                  </p>
                </div>
              </div>

              <div className="mt-6">
                {featuredPrice ? (
                  <>
                    <PriceDisplay
                      price={featuredPrice}
                      change24h={null}
                      change7d={null}
                      confidence={gradedPrices.psa10?.average ? 'high' : 'medium'}
                      lastSaleDate={lastUpdated}
                      size="xl"
                    />
                    <p className="mt-2 text-sm text-zinc-500">
                      {gradedPrices.psa10?.average ? 'PSA 10' : 'Best Available'} Market Price
                    </p>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-medium text-zinc-700">No verified market price available yet.</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Prices appear after source-backed comps are indexed for this card.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Grade Selector */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                Select Grade
              </h3>
              <GradeSelector
                grades={availableGrades}
                activeGrade="psa-10"
                cardSlug={cardSlug}
                gameSlug={game}
                setSlug={set}
              />
            </div>

            {/* Price Matrix - Progressive Disclosure */}
            <PriceMatrix
              rawPrices={rawPrices}
              gradedPrices={gradedPrices}
            />

            {/* Price Ladder */}
            {priceLadderEntries.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <PriceLadder
                    entries={priceLadderEntries}
                    cardSlug={cardSlug}
                    gameSlug={game}
                    setSlug={set}
                    activeGrade="psa-10"
                  />
                </CardContent>
              </Card>
            )}

            {/* Population & Rarity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Population & Rarity Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(population).length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg bg-zinc-50 p-4">
                      <p className="text-sm text-zinc-500">PSA 10 Population</p>
                      <p className="text-2xl font-bold text-zinc-900">
                        {formatNumber(population['psa-10'] || 0)}
                      </p>
                      {population['psa-10'] && Object.values(population).reduce((a, b) => a + b, 0) > 0 && (
                        <p className="mt-1 text-sm text-emerald-600">
                          Top {((population['psa-10'] / Object.values(population).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}% of all graded copies
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-4">
                      <p className="text-sm text-zinc-500">Total Graded (PSA)</p>
                      <p className="text-2xl font-bold text-zinc-900">
                        {formatNumber(Object.values(population).reduce((a, b) => a + b, 0))}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Across all grades
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center">
                    <p className="text-sm font-medium text-zinc-700">No verified population report available yet.</p>
                    <p className="mt-1 text-xs text-zinc-500">Population values appear after source-backed grading data is indexed.</p>
                  </div>
                )}
                {population['psa-10'] && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm text-amber-800">
                      <strong>Rarity Insight:</strong> Only {population['psa-10']} PSA 10s exist
                      {Object.values(population).reduce((a, b) => a + b, 0) > 0 &&
                        ` - this represents just ${((population['psa-10'] / Object.values(population).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}% of graded copies.`
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Price History Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Price History</CardTitle>
              </CardHeader>
              <CardContent>
                <PriceChart data={priceHistory} height={300} />
              </CardContent>
            </Card>

            {/* Market Intelligence */}
            <Card>
              <CardHeader>
                <CardTitle>Market Intelligence</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="sales">
                  <TabsList>
                    <TabsTrigger value="sales">Recent Sales</TabsTrigger>
                    <TabsTrigger value="listings">Active Listings</TabsTrigger>
                  </TabsList>

                  <TabsContent value="sales" className="mt-4">
                    {(() => {
                      // Pull real eBay sales from price_cache.ebay_sales
                      const ebaySales = dbPriceCache?.ebay_sales;
                      const realSales: { grade: string; average: number; count: number }[] = [];
                      if (ebaySales && typeof ebaySales === 'object') {
                        for (const [grade, data] of Object.entries(ebaySales)) {
                          if (data && typeof data === 'object' && 'average' in data) {
                            const avg = (data as { average?: number }).average;
                            const cnt = (data as { count?: number }).count;
                            if (avg) realSales.push({ grade, average: avg, count: cnt || 0 });
                          }
                        }
                        realSales.sort((a, b) => b.average - a.average);
                      }
                      if (realSales.length > 0) {
                        return (
                          <div className="space-y-2">
                            {realSales.slice(0, 8).map((sale, index) => (
                              <div key={index} className="flex items-center justify-between rounded-lg bg-zinc-50 p-3">
                                <div>
                                  <p className="font-medium text-zinc-900">{formatPrice(sale.average)}</p>
                                  <p className="text-sm text-zinc-500">{sale.grade.toUpperCase().replace(/([a-z]+)(\d)/, '$1 $2')}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-zinc-500">{sale.count} sales</p>
                                  <p className="text-xs text-zinc-400">eBay avg</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return (
                        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center">
                          <p className="text-sm font-medium text-zinc-700">No verified recent sales available yet.</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            TCGMaster only shows sales here after source-backed data is indexed.
                          </p>
                        </div>
                      );
                    })()}
                  </TabsContent>

                  <TabsContent value="listings" className="mt-4">
                    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center">
                      <p className="text-sm font-medium text-zinc-700">No verified active listings available yet.</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Active listings will appear here once source links, seller data, and timestamps are indexed.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Card Information */}
            <Card>
              <CardHeader>
                <CardTitle>Card Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-zinc-500">Set</dt>
                    <dd className="font-medium text-zinc-900">
                      <Link href={`/${game}/${set}`} className="hover:underline">
                        {card.set.name}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-zinc-500">Number</dt>
                    <dd className="font-medium text-zinc-900">
                      {card.number.includes('/') ? card.number : `${card.number}/${card.set.card_count}`}
                    </dd>
                  </div>
                  {card.rarity && (
                    <div>
                      <dt className="text-sm text-zinc-500">Rarity</dt>
                      <dd className="font-medium text-zinc-900">
                        {getRarityDisplay(card.rarity)}
                      </dd>
                    </div>
                  )}
                  {card.artist && (
                    <div>
                      <dt className="text-sm text-zinc-500">Artist</dt>
                      <dd className="font-medium text-zinc-900">
                        {card.artist}
                      </dd>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-zinc-500">Release Date</dt>
                    <dd className="font-medium text-zinc-900">
                      {card.set.release_date ? formatDate(card.set.release_date) : 'Unknown'}
                    </dd>
                  </div>
                </dl>

                {card.description && (
                  <div className="mt-6 border-t border-zinc-200 pt-4">
                    <h4 className="mb-2 text-sm font-semibold text-zinc-500">Description</h4>
                    <p className="text-zinc-700">{card.description}</p>
                  </div>
                )}

                {card.lore && (
                  <div className="mt-4 border-t border-zinc-200 pt-4">
                    <h4 className="mb-2 text-sm font-semibold text-zinc-500">Lore</h4>
                    <p className="text-zinc-700 italic">{card.lore}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Price Alert CTA */}
            <div className="rounded-xl border-2 border-dashed border-zinc-200 p-6 text-center">
              <Bell className="mx-auto h-8 w-8 text-zinc-400" />
              <h3 className="mt-2 font-semibold text-zinc-900">
                Set a Price Alert
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Get notified when this card moves {'>'}10%
              </p>
              <Button className="mt-4">
                <Bell className="h-4 w-4" />
                Create Alert
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
