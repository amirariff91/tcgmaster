import Link from 'next/link';
import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Bell, Plus, Share2, Info, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardImage } from '@/components/card/card-image';
import { FormattedPrice } from '@/components/ui/formatted-price';
import { CollectrChart } from '@/components/charts/collectr-chart';
import { formatPrice, formatNumber, getRarityDisplay, formatDate, formatDisplayNumber, formatSetName, splitCardName } from '@/lib/utils';
import { createPublicClient as createClient, createServerClient } from '@/lib/supabase/client';
import { getCardWithPrices } from '@/lib/ppt/service';
import { calculatePriceChange24h } from '@/lib/pricing/trending';

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
  graded_prices: Record<string, any>;
  ebay_sales: Record<string, unknown>;
  fetched_at: string;
  expires_at: string;
}

interface CardDataPriceHistory {
  id: string;
  card_id: string;
  variant_id: string | null;
  grading_company_id: string | null;
  grade: string;
  price: number;
  recorded_at: string;
  source: string;
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
  local_image_url: string | null;
  tcg_player_id: string | null;
  sets: CardDataSet;
  card_variants: { id: string; variant_type: string; name: string; slug: string }[];
  price_cache: CardDataPriceCache | CardDataPriceCache[] | null;
  price_cache_ttl: number | null;
  price_history: CardDataPriceHistory[];
  population_reports: CardDataPopulation[];
  print_run_info?: any;
  tcgplayer_url?: string;
  snkrdunk_url?: string;
  cardrush_url?: string;
  yuyutei_url?: string;
}

async function getCardData(gameSlug: string, setSlug: string, cardSlug: string) {
  const supabase = createClient();

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
      local_image_url,
      tcg_player_id,
      price_cache_ttl,
      print_run_info,
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
        id,
        card_id,
        variant_id,
        grading_company_id,
        grade,
        price,
        recorded_at,
        source
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

  return card as unknown as CardData;
}

// Retired `one-piece-<code>` slugs (deduped 2026-07-22, merged into `op-<code>`) resolve
// to their canonical `op-<code>` card so old/indexed URLs 308-redirect instead of 404.
async function resolveRetiredOnePieceSlug(
  gameSlug: string,
  cardSlug: string
): Promise<string | null> {
  if (!cardSlug.startsWith('one-piece-')) return null;
  const winnerSlug = `op-${cardSlug.slice('one-piece-'.length).toLowerCase()}`;

  const supabase = await createClient();
  const { data } = await supabase
    .from('cards')
    .select('slug, sets!inner ( slug, games!inner ( slug ) )')
    .eq('slug', winnerSlug)
    .eq('sets.games.slug', gameSlug)
    .single();

  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setSlug = (data as any).sets?.slug as string | undefined;
  if (!setSlug) return null;
  return `/${gameSlug}/${setSlug}/${winnerSlug}`;
}

interface PageProps {
  params: Promise<{
    game: string;
    set: string;
    card: string;
  }>;
}

export const revalidate = 900; 

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
  const cardData = await getCardData(game, set, cardSlug);

  if (!cardData) {
    const retired = await resolveRetiredOnePieceSlug(game, cardSlug);
    if (retired) permanentRedirect(retired);
    notFound();
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
    local_image_url: cardData.local_image_url,
    description: cardData.description,
    set: {
      id: setData?.id || '',
      name: setData?.name ? formatSetName(setData.name) : '',
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

  const dbPriceCache = Array.isArray(cardData?.price_cache)
    ? cardData?.price_cache[0] || null
    : cardData?.price_cache || null;

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
    } catch {}
  }

  const rawPrices = {
    nearMint: dbPriceCache?.raw_prices?.nearMint ?? dbPriceCache?.raw_prices?.market ?? livePrices?.raw?.nearMint ?? null,
    lightlyPlayed: dbPriceCache?.raw_prices?.lightlyPlayed ?? dbPriceCache?.raw_prices?.low ?? livePrices?.raw?.lightlyPlayed ?? null,
    moderatelyPlayed: dbPriceCache?.raw_prices?.moderatelyPlayed ?? livePrices?.raw?.moderatelyPlayed ?? null,
    heavilyPlayed: dbPriceCache?.raw_prices?.heavilyPlayed ?? livePrices?.raw?.heavilyPlayed ?? null,
  };

  let gradedPrices: Record<string, GradedPriceData> = {};
  if (livePrices?.graded) {
    gradedPrices = livePrices.graded;
  } else if (dbPriceCache?.graded_prices) {
    for (const [grade, sources] of Object.entries(dbPriceCache.graded_prices)) {
      if (sources && typeof sources === 'object') {
        const prices = Object.values(sources).filter(v => typeof v === 'number') as number[];
        if (prices.length > 0) {
          gradedPrices[grade] = {
            average: Math.min(...prices),
            median: null,
            low: Math.min(...prices),
            high: Math.max(...prices),
            count: prices.length
          };
        }
      }
    }
  }


  const populationReports = cardData?.population_reports || [];
  const population: Record<string, number> = {};
  let totalPop = 0;
  for (const pop of populationReports) {
    population[`psa-${pop.grade}`] = pop.count;
    totalPop += pop.count;
  }
  const psa10Pop = population['psa-10'] || 0;

  const priceHistoryData = (cardData?.price_history || []).filter((h) => h.source !== 'ppt-api');
  const gradeLabel = gradedPrices.psa10?.average ? 'PSA 10' : (gradedPrices.psa9?.average ? 'PSA 9' : 'Raw');
  const activeGradeForChart = gradedPrices.psa10?.average ? '10' : (gradedPrices.psa9?.average ? '9' : 'raw');

  // Ensure "Compared Markets" always uses raw prices
  const rawHistoryData = priceHistoryData.filter(h => h.grade === 'raw');
  
  const relevantHistory = priceHistoryData.filter(h => h.grade === activeGradeForChart || h.grade === `psa${activeGradeForChart}`);
  
  let featuredPrice = gradedPrices.psa10?.average || gradedPrices.psa9?.average || rawPrices.nearMint || null;
  let winningSource = 'Market';

  if (relevantHistory.length > 0) {
    const latestEntry = [...relevantHistory].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
    featuredPrice = latestEntry.price;
    winningSource = latestEntry.source || 'Market';
  }

  // --- Start DB Sync (Self-Healing) ---
  const currentTtl = cardData.price_cache_ttl;
  const newTtl = featuredPrice ? Math.round(featuredPrice * 100) : null;
  
  if (currentTtl !== newTtl) {
    const adminClient = createServerClient();
    // @ts-ignore - Supabase type inference issue with the update payload
    adminClient.from('cards').update({ price_cache_ttl: newTtl as any }).eq('id', cardData.id).then(({ error }) => {
      if (error) console.error('Failed to sync price_cache_ttl:', error);
    });
  }
  // --- End DB Sync ---

  const chartDataMap = new Map<string, Record<string, string | number>>();
  const availableSources = new Set<string>();

  relevantHistory.forEach(h => {
    const date = h.recorded_at.split('T')[0];
    const source = h.source || 'Market';
    
    // Skip 'Market' source for charts
    if (source === 'Market') return;

    availableSources.add(source);

    if (!chartDataMap.has(date)) {
      chartDataMap.set(date, { date });
    }
    const entry = chartDataMap.get(date)!;
    entry[source] = h.price;
  });

  const priceHistory = Array.from(chartDataMap.values()).sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
  const chartSources = Array.from(availableSources);

  const priceChange24h = calculatePriceChange24h(relevantHistory);

  const priceLadderEntries = [
    { grade: 'raw' as const, grading_company: null, price: rawPrices.nearMint || 0, confidence: 'high' as const, last_sale_date: null, population: null },
    { grade: '7' as const, grading_company: 'psa' as const, price: gradedPrices.psa7?.average || 0, confidence: 'high' as const, last_sale_date: null, population: population['psa-7'] || null },
    { grade: '8' as const, grading_company: 'psa' as const, price: gradedPrices.psa8?.average || 0, confidence: 'high' as const, last_sale_date: null, population: population['psa-8'] || null },
    { grade: '9' as const, grading_company: 'psa' as const, price: gradedPrices.psa9?.average || 0, confidence: 'high' as const, last_sale_date: null, population: population['psa-9'] || null },
    { grade: '10' as const, grading_company: 'psa' as const, price: gradedPrices.psa10?.average || 0, confidence: 'medium' as const, last_sale_date: null, population: population['psa-10'] || null },
  ];

  const availableGrades = [
    { grade: 'raw' as const, grading_company: null, hasData: rawPrices.nearMint !== null },
    { grade: '9' as const, grading_company: 'psa' as const, hasData: !!gradedPrices.psa9?.average },
    { grade: '10' as const, grading_company: 'psa' as const, hasData: !!gradedPrices.psa10?.average },
  ].filter(g => g.hasData);
  
  const ebaySales = dbPriceCache?.ebay_sales;
  let totalSalesVolume = 0;
  if (ebaySales && typeof ebaySales === 'object') {
      for (const data of Object.values(ebaySales)) {
          if (data && typeof data === 'object' && 'count' in data) {
              totalSalesVolume += (data as { count?: number }).count || 0;
          }
      }
  }

  const latestPricesMap = new Map<string, { price: number; date: string }>();
  rawHistoryData.forEach(h => {
    const source = h.source || 'Market';
    if (source === 'Market') return; // Skip Market from compared markets
    const current = latestPricesMap.get(source);
    if (!current || new Date(h.recorded_at) > new Date(current.date)) {
      latestPricesMap.set(source, { price: h.price, date: h.recorded_at });
    }
  });

  const latestPricesList = Array.from(latestPricesMap.entries())
    .map(([source, data]) => ({ source, price: data.price, date: data.date }))
    .sort((a, b) => a.price - b.price);

  const { baseName: cleanName, variantInfo } = splitCardName(card.name);

  return (
    <div className="min-h-screen bg-[#060c18] pt-24 pb-20">

      {/* Hero Section */}
      <div className="container max-w-[1400px] mx-auto py-6 lg:py-10 px-4 sm:px-6 relative z-10">
        
        {/* Sleek Breadcrumb */}
        <nav className="flex items-center gap-2 text-[13px] text-zinc-400 mb-8">
          <Link href={`/${game}`} className="hover:text-white transition-colors">{card.game.display_name}</Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          <Link href={`/${game}/${set}`} className="hover:text-white transition-colors truncate max-w-[200px]">{card.set.name}</Link>
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          <span className="text-white font-medium truncate max-w-[200px]">{cleanName}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Column 1: Image Showcase (col-span-3) */}
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-24 group perspective-[1000px]">
              <div className="relative max-w-[260px] sm:max-w-full mx-auto transition-transform duration-500 ease-out group-hover:scale-[1.02] group-hover:-rotate-y-2 group-hover:rotate-x-2">
                <CardImage
                  src={card.local_image_url || card.image_url}
                  alt={cleanName}
                  size="hero"
                  priority
                  className="w-full h-auto drop-shadow-2xl rounded-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 rounded-2xl pointer-events-none transition-opacity duration-500" />
              </div>
              
              <div className="mt-8 flex justify-center gap-3">
                <Button className="w-full shadow-[0_0_15px_rgba(255,255,255,0.1)] rounded-full bg-white text-[#060c18] hover:bg-zinc-200 hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] transition-all duration-200 h-12 text-sm font-bold tracking-wide">
                  <Plus className="h-4 w-4 mr-2" /> Add to Portfolio
                </Button>
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-white/10 bg-white/5 hover:bg-white/10 transition-colors duration-200">
                  <Share2 className="h-4 w-4 text-zinc-300" />
                </Button>
              </div>
            </div>
          </div>

          {/* Column 2: Header, Price & Info (col-span-4) */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
            
            {/* Header */}
            <div>
              <h1 className="text-2xl sm:text-[32px] font-[800] text-white tracking-tight leading-tight mb-1 font-sans">
                {cleanName}
              </h1>
              {variantInfo && (
                <div className="inline-block text-sm font-semibold tracking-wide text-zinc-400 mt-1 mb-1">
                  {variantInfo}
                </div>
              )}
              {card.artist && (
                <p className="text-zinc-400 font-medium mt-1">
                  Illustrated by <span className="text-zinc-300">{card.artist}</span>
                </p>
              )}
              {cardData.print_run_info?.tcgplayer_card_name && (
                <p className="text-zinc-400 font-medium text-xs mt-1 bg-white/10 inline-block px-2 py-0.5 rounded-sm">
                  TCGPlayer: <span className="text-zinc-300">{cardData.print_run_info.tcgplayer_card_name}</span>
                </p>
              )}
            </div>

            {/* Price */}
            <div>
              <p className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-2 flex items-center">
                Market Value ({gradeLabel})
                {winningSource && winningSource !== 'Market' && <span className="ml-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 tracking-wider">Source: {winningSource}</span>}
              </p>
              <div className="flex items-baseline gap-4">
                {featuredPrice ? (
                  <>
                    <FormattedPrice price={featuredPrice} className="text-3xl sm:text-[36px] font-[800] text-orange-400 tracking-tight tabular-nums font-sans" />
                    {priceChange24h !== null && (
                      <div className={`flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${priceChange24h >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {priceChange24h >= 0 ? '↑' : '↓'} {Math.abs(priceChange24h).toFixed(1)}%
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-3xl sm:text-[36px] font-[800] text-zinc-600 tracking-tight font-sans">
                    No Data Yet
                  </span>
                )}
              </div>
            </div>

            {/* Card Data Grid */}
            <div className="bg-[#0b1329]/80 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Card Data</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <dt className="text-zinc-400 font-medium">Set Name</dt>
                  <dd className="text-white font-semibold text-right max-w-[60%] truncate" title={card.set.name}>{card.set.name}</dd>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <dt className="text-zinc-400 font-medium">Release Date</dt>
                  <dd className="text-white font-semibold">{card.set.release_date ? formatDate(card.set.release_date) : 'Unknown'}</dd>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <dt className="text-zinc-400 font-medium">Card Number</dt>
                  <dd className="text-white font-semibold">{formatDisplayNumber(card.game?.slug, card.number, card.set?.card_count)}</dd>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <dt className="text-zinc-400 font-medium">Rarity</dt>
                  <dd className="text-white font-semibold">{card.rarity ? getRarityDisplay(card.rarity) : 'Unknown'}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-zinc-400 font-medium">Artist</dt>
                  <dd className="text-white font-semibold">{card.artist || 'Unknown'}</dd>
                </div>
              </dl>
            </div>

            {/* Pulse / Quick Stats (Relocated here to replace Card Text) */}
            <div className="grid grid-cols-3 divide-x divide-white/10 bg-[#0b1329]/80 backdrop-blur-sm rounded-2xl border border-white/10 py-4 lg:py-6 px-2">
              <div className="px-4 flex flex-col items-center text-center">
                <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">PSA 10 Pop</span>
                <span className="text-2xl font-black text-white tabular-nums">{psa10Pop > 0 ? formatNumber(psa10Pop) : '--'}</span>
                <span className="text-zinc-500 text-[10px] mt-1 font-medium">{totalPop > 0 ? formatNumber(totalPop) : '--'} total</span>
              </div>
              <div className="px-4 flex flex-col items-center text-center">
                <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">Recent Sales</span>
                <span className="text-2xl font-black text-white tabular-nums">{totalSalesVolume > 0 ? totalSalesVolume : '--'}</span>
                <span className="text-zinc-500 text-[10px] mt-1 font-medium">Tracked volume</span>
              </div>
              <div className="px-4 flex flex-col items-center text-center">
                <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">Availability</span>
                <span className="text-2xl font-black text-white">High</span>
                <span className="text-zinc-500 text-[10px] mt-1 font-medium">Liquid market</span>
              </div>
            </div>
            
          </div>

          {/* Column 3: Chart & Stats (col-span-5) */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            <CollectrChart 
              priceHistory={priceHistoryData} 
              gradeInfos={priceLadderEntries} 
            />



            {/* Compared Markets */}
            {latestPricesList.length > 0 && (
              <div className="bg-[#0b1329]/80 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden shadow-sm">
                <div className="bg-white/5 px-5 py-3 border-b border-white/10">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Compared Markets (Raw)</h3>
                </div>
                <div className="divide-y divide-white/10">
                  {latestPricesList.map((item) => {
                    const getMarketLogo = (source: string) => {
                      const s = source.toLowerCase();
                      if (s.includes('snkrdunk')) return '/logos/snkrdunk.png';
                      if (s.includes('yuyutei')) return '/logos/yuyutei.png';
                      if (s.includes('cardrush')) return '/logos/cardrush.png';
                      if (s.includes('tcgplayer')) return '/logos/tcgplayer.png';
                      if (s.includes('tcg republic')) return '/logos/tcgrepublic.png';
                      return null;
                    };
                    const logo = getMarketLogo(item.source);
                    
                    return (
                    <div key={item.source} className="flex justify-between items-center px-5 py-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        {logo ? (
                          <img 
                            src={logo} 
                            alt={item.source} 
                            className={`w-8 h-8 rounded-md border border-white/10 shadow-sm bg-white/5 ${
                              item.source.toLowerCase().includes('snkrdunk') 
                                ? 'object-cover p-0 overflow-hidden' 
                                : 'object-contain p-1'
                            }`} 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md border border-white/10 shadow-sm bg-white/5 flex items-center justify-center text-zinc-400">
                            <span className="text-xs font-bold">{item.source.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <span className="text-white font-bold capitalize">{item.source}</span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <FormattedPrice price={item.price} className="text-orange-400 font-bold text-lg tabular-nums leading-none" />
                        <span className="text-[10px] text-zinc-500 mt-1 font-medium uppercase tracking-wider">{formatDate(item.date)}</span>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
