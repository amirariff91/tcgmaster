import Link from 'next/link';
import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import { ChevronRight } from 'lucide-react';
import { CardImage } from '@/components/card/card-image';
import { CardDetailActions } from '@/components/card/card-detail-actions';
import { RelatedCards, type RelatedCard } from '@/components/card/related-cards';
import { FormattedPrice } from '@/components/ui/formatted-price';
import { CollectrChart } from '@/components/charts/collectr-chart';
import { PriceFreshness } from '@/components/card/price-freshness';
import { formatPrice, formatNumber, getRarityDisplay, formatDate, formatDisplayNumber, formatSetName, splitCardName } from '@/lib/utils';
import { getCardWithPrices } from '@/lib/ppt/service';
import { dbQuery } from '@/lib/db/client';
import { calculatePriceChange24h } from '@/lib/pricing/trending';
import { latestRecordedAt, priceKindLabel, type PriceKind } from '@/lib/pricing/price-labels';

// `price_history.source` values are lowercase enum members; match on substring so
// display casing and multi-word names ("TCG Republic") still resolve.

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
  sources?: Record<string, number | null>;
}

interface CurrentSourcePrice {
  usd: number | null;
  native: number | null;
  currency: string | null;
  kind: PriceKind | null;
  recorded_at: string | null;
}

interface CardDataVariant {
  id: string;
  variant_type: string;
  name: string;
  slug: string;
}

interface CardDataPriceCurrent {
  source_prices: Record<string, CurrentSourcePrice>;
  graded_prices: Record<string, GradedPriceData>;
  headline_cents: number | null;
  headline_source: string | null;
  headline_kind: PriceKind | null;
  headline_currency: string | null;
  headline_grade: string | null;
}

interface CardDataPriceHistory {
  id: string;
  card_id: string;
  variant_id: string | null;
  grading_company_id: string | null;
  grade: string | null;
  price: number;
  recorded_at: string;
  source: string | null;
}

interface CardDataPopulation {
  grade: string;
  count: number;
  grading_company_id: string | null;
}

interface PrintRunInfo {
  tcgplayer_card_name?: string;
}

interface CardData {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity: string;
  artist: string | null;
  description: string | null;
  image_url: string;
  local_image_url: string | null;
  tcg_player_id: string | null;
  sets: CardDataSet;
  card_variants: CardDataVariant[];
  card_price_current: CardDataPriceCurrent | null;
  price_cache_ttl: number | null;
  price_history: CardDataPriceHistory[];
  population_reports: CardDataPopulation[];
  print_run_info?: PrintRunInfo | string | null;
  tcgplayer_url?: string;
  snkrdunk_url?: string;
  cardrush_url?: string;
  yuyutei_url?: string;
  card_source_mapping?: { source: string; external_url: string }[];
}

async function getCardData(gameSlug: string, setSlug: string, cardSlug: string): Promise<CardData | null> {
  const rows = await dbQuery(`
    SELECT
      c.id,
      c.name,
      c.slug,
      c.number,
      c.rarity,
      c.artist,
      c.description,
      c.image_url,
      c.local_image_url,
      c.tcg_player_id,
      c.price_cache_ttl,
      c.print_run_info,
      c.tcgplayer_url,
      c.snkrdunk_url,
      c.yuyutei_url,
      c.cardrush_url,
      json_build_object(
        'id', s.id,
        'name', s.name,
        'slug', s.slug,
        'release_date', s.release_date,
        'card_count', s.card_count,
        'games', json_build_object(
          'id', g.id,
          'name', g.name,
          'slug', g.slug,
          'display_name', g.display_name
        )
      ) AS sets,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', cv.id,
          'variant_type', cv.variant_type,
          'name', cv.name,
          'slug', cv.slug
        ) ORDER BY cv.id)
        FROM card_variants cv
        WHERE cv.card_id = c.id
      ), '[]'::json) AS card_variants,
      (
        SELECT json_build_object(
          'source_prices', cp.source_prices,
          'graded_prices', cp.graded_prices,
          'headline_cents', cp.headline_cents,
          'headline_source', cp.headline_source,
          'headline_kind', cp.headline_kind,
          'headline_currency', cp.headline_currency,
          'headline_grade', cp.headline_grade
        )
        FROM card_price_current cp
        WHERE cp.card_id = c.id
      ) AS card_price_current,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', ph.id,
          'card_id', ph.card_id,
          'variant_id', ph.variant_id,
          'grading_company_id', ph.grading_company_id,
          'grade', ph.grade,
          'price', ph.price::float8,
          'recorded_at', ph.recorded_at,
          'source', ph.source
        ) ORDER BY ph.recorded_at)
        FROM price_history ph
        WHERE ph.card_id = c.id
      ), '[]'::json) AS price_history,
      COALESCE((
        SELECT json_agg(json_build_object(
          'source', csm.source,
          'external_url', csm.external_url
        ) ORDER BY csm.source)
        FROM card_source_mapping csm
        WHERE csm.card_id = c.id
      ), '[]'::json) AS card_source_mapping,
      COALESCE((
        SELECT json_agg(json_build_object(
          'grade', pr.grade,
          'count', pr.count,
          'grading_company_id', pr.grading_company_id
        ) ORDER BY pr.grade)
        FROM population_reports pr
        WHERE pr.card_id = c.id
      ), '[]'::json) AS population_reports
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE c.slug = $1
      AND s.slug = $2
      AND g.slug = $3
    LIMIT 1
  `, [cardSlug, setSlug, gameSlug]) as CardData[];

  return rows[0] || null;
}

// A handful of siblings from the same set, so the card page is not a dead end.
async function getRelatedCards(setId: string, excludeCardId: string): Promise<RelatedCard[]> {
  try {
    const rows = await dbQuery<RelatedCard>(`
      SELECT id, slug, name, number, rarity, image_url, local_image_url, price_cache_ttl
      FROM cards
      WHERE set_id = $1
        AND id <> $2
      ORDER BY price_cache_ttl DESC NULLS LAST
      LIMIT 6
    `, [setId, excludeCardId]);

    return rows;
  } catch (e) {
    console.error('Failed to fetch related cards:', e);
    return [];
  }
}

// Retired `one-piece-<code>` slugs (deduped 2026-07-22, merged into `op-<code>`) resolve
// to their canonical `op-<code>` card so old/indexed URLs 308-redirect instead of 404.
async function resolveRetiredOnePieceSlug(
  gameSlug: string,
  cardSlug: string
): Promise<string | null> {
  if (!cardSlug.startsWith('one-piece-')) return null;
  const winnerSlug = `op-${cardSlug.slice('one-piece-'.length).toLowerCase()}`;

  const rows = await dbQuery<{ slug: string; set_slug: string }>(`
    SELECT c.slug, s.slug AS set_slug
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE c.slug = $1
      AND g.slug = $2
    LIMIT 1
  `, [winnerSlug, gameSlug]);

  const row = rows[0];
  if (!row?.set_slug) return null;
  return `/${gameSlug}/${row.set_slug}/${winnerSlug}`;
}

interface PageProps {
  params: Promise<{
    game: string;
    set: string;
    card: string;
  }>;
}

// Prices change roughly once every couple of days per card, while a card gets ~5
// views/day — so a short TTL never catches a second view and just re-renders on
// almost every request. Instead this is a long ceiling plus on-demand purging:
// the price scrapers POST to /api/revalidate/card and the Inngest price jobs call
// revalidatePath directly, so a page is invalidated when its price actually
// changes rather than on a timer. That is both a real cache hit rate and better
// freshness than a 5-minute TTL delivered.
//
// Anything derived from Date.now() during render now freezes for up to a day —
// see components/card/price-freshness.tsx.
export const revalidate = 0;

// Next 16 only puts a dynamic segment on the ISR path when it declares
// generateStaticParams. The catalogue is ~15k cards, so prerender nothing at build
// time and let `dynamicParams` (default true) generate + cache each page on first
// request, then serve it from the cache until `revalidate` expires.
export async function generateStaticParams() {
  return [];
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { game, set, card: cardSlug } = await params;
  let cardData: CardData | null = null;
  try {
    cardData = await getCardData(game, set, cardSlug);
  } catch (error) {
    // Metadata is best-effort so a build-time DB outage does not fail the route.
    console.error('Failed to load card metadata:', error);
    await connection();
  }

  const cardName = cardData?.name || cardSlug;
  const setName = cardData?.sets?.name || set;
  const currentPrice = cardData?.card_price_current;
  const headlinePrice = currentPrice?.headline_cents == null
    ? null
    : currentPrice.headline_cents / 100;
  const priceDescription = headlinePrice !== null
    ? `Current ${priceKindLabel(currentPrice?.headline_kind).toLowerCase()} reference: ${formatPrice(headlinePrice)}.`
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
  let cardData: CardData | null = null;
  try {
    cardData = await getCardData(game, set, cardSlug);
  } catch (error) {
    console.error('Failed to load card:', error);
  }

  if (!cardData) {
    let retired: string | null = null;
    try {
      retired = await resolveRetiredOnePieceSlug(game, cardSlug);
    } catch (error) {
      console.error('Failed to resolve retired card slug:', error);
    }
    if (retired) permanentRedirect(retired);
    notFound();
  }

  const setData = cardData.sets;
  const gameData = setData.games;
  const relatedCards = await getRelatedCards(setData.id, cardData.id);

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

  const printRunInfo = typeof cardData.print_run_info === 'object' && cardData.print_run_info !== null
    ? cardData.print_run_info
    : null;

  const currentPrices = cardData.card_price_current;
  const shouldUseLivePrices = currentPrices === null || (
    currentPrices.headline_cents === null &&
    Object.keys(currentPrices.graded_prices || {}).length === 0
  );
  let livePrices: {
    headline: { usd: number | null; kind: PriceKind };
    graded: Record<string, GradedPriceData>;
  } | null = null;
  if (shouldUseLivePrices && cardData.tcg_player_id) {
    try {
      const pptData = await getCardWithPrices(cardData.tcg_player_id, { includeEbay: true });
      if (pptData) {
        livePrices = {
          headline: pptData.prices.headline,
          graded: pptData.prices.graded as Record<string, GradedPriceData>,
        };
      }
    } catch {}
  }

  const sourcePrices = currentPrices?.source_prices || {};
  const gradedPrices: Record<string, GradedPriceData> = currentPrices?.graded_prices || livePrices?.graded || {};
  const featuredPrice = currentPrices?.headline_cents != null
    ? currentPrices.headline_cents / 100
    : livePrices?.headline.usd ?? null;
  const featuredKind = currentPrices?.headline_kind ?? livePrices?.headline.kind;
  const headlineGrade = currentPrices?.headline_grade || (livePrices ? 'raw' : null);
  const gradeLabel = !headlineGrade || headlineGrade === 'raw'
    ? 'Raw'
    : headlineGrade.replace(/^psa/i, 'PSA ');
  const activeGradeForChart = !headlineGrade || headlineGrade === 'raw'
    ? 'raw'
    : headlineGrade.replace(/^psa/i, '');
  const winningSource = currentPrices?.headline_source;
  const rawPrice = !headlineGrade || headlineGrade === 'raw' ? featuredPrice : null;

  const COMPANY_UUIDS_TO_SLUG: Record<string, string> = {
    '74c51627-cc4b-4a82-a1c0-52b3975b47b7': 'psa',
    '7ffb12c6-eb42-4f9e-ad37-a9a3b6f007b8': 'bgs',
    'dce6169f-8958-4229-861b-686a4644c984': 'cgc',
    'da09e2df-2464-40f2-ae0e-0296253d811f': 'tag'
  };

  const populationReports = (cardData?.population_reports || []).map(pop => ({
    ...pop,
    grading_company_id: pop.grading_company_id ? (COMPANY_UUIDS_TO_SLUG[pop.grading_company_id] || pop.grading_company_id) : 'psa'
  }));
  const population: Record<string, number> = {};
  let totalPop = 0;
  for (const pop of populationReports) {
    const company = pop.grading_company_id.toLowerCase().replace(/[^a-z]/g, '');
    population[`${company}-${pop.grade}`] = pop.count;
    totalPop += pop.count;
  }
  const psa10Pop = population['psa-10'] || 0;

  const priceHistoryData = (cardData?.price_history || [])
    .filter((h): h is CardDataPriceHistory & { grade: string; source: string } => (
      h.source !== 'ppt-api' && h.source !== null && h.grade !== null
    ))
    .map(h => ({
      ...h,
      grading_company_id: h.grading_company_id ? (COMPANY_UUIDS_TO_SLUG[h.grading_company_id] || h.grading_company_id) : null
    }));

  const relevantHistory = priceHistoryData.filter(h => h.grade === activeGradeForChart || h.grade === `psa${activeGradeForChart}`);

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
    { grade: 'raw' as const, grading_company: null, price: rawPrice || 0, sources: {}, confidence: 'high' as const, last_sale_date: null, population: null },
    { grade: '10' as const, grading_company: 'psa' as const, price: gradedPrices.psa10?.average || 0, sources: gradedPrices.psa10?.sources, confidence: 'medium' as const, last_sale_date: null, population: population['psa-10'] || null },
    { grade: '9' as const, grading_company: 'psa' as const, price: gradedPrices.psa9?.average || 0, sources: gradedPrices.psa9?.sources, confidence: 'high' as const, last_sale_date: null, population: population['psa-9'] || null },
    { grade: '8' as const, grading_company: 'psa' as const, price: gradedPrices.psa8?.average || 0, sources: gradedPrices.psa8?.sources, confidence: 'high' as const, last_sale_date: null, population: population['psa-8'] || null },
    { grade: '7' as const, grading_company: 'psa' as const, price: gradedPrices.psa7?.average || 0, sources: gradedPrices.psa7?.sources, confidence: 'high' as const, last_sale_date: null, population: population['psa-7'] || null },
    // CGC
    { grade: '10' as const, grading_company: 'cgc' as const, price: gradedPrices.cgc10?.average || 0, sources: gradedPrices.cgc10?.sources, confidence: 'medium' as const, last_sale_date: null, population: population['cgc-10'] || null },
    { grade: '9' as const, grading_company: 'cgc' as const, price: gradedPrices.cgc9?.average || 0, sources: gradedPrices.cgc9?.sources, confidence: 'high' as const, last_sale_date: null, population: population['cgc-9'] || null },
    { grade: '8' as const, grading_company: 'cgc' as const, price: gradedPrices.cgc8?.average || 0, sources: gradedPrices.cgc8?.sources, confidence: 'high' as const, last_sale_date: null, population: population['cgc-8'] || null },
    { grade: '7' as const, grading_company: 'cgc' as const, price: gradedPrices.cgc7?.average || 0, sources: gradedPrices.cgc7?.sources, confidence: 'high' as const, last_sale_date: null, population: population['cgc-7'] || null },
    // BGS
    { grade: '10' as const, grading_company: 'bgs' as const, price: gradedPrices.bgs10?.average || 0, sources: gradedPrices.bgs10?.sources, confidence: 'medium' as const, last_sale_date: null, population: population['bgs-10'] || null },
    { grade: '9' as const, grading_company: 'bgs' as const, price: gradedPrices.bgs9?.average || 0, sources: gradedPrices.bgs9?.sources, confidence: 'high' as const, last_sale_date: null, population: population['bgs-9'] || null },
    { grade: '8' as const, grading_company: 'bgs' as const, price: gradedPrices.bgs8?.average || 0, sources: gradedPrices.bgs8?.sources, confidence: 'high' as const, last_sale_date: null, population: population['bgs-8'] || null },
    { grade: '7' as const, grading_company: 'bgs' as const, price: gradedPrices.bgs7?.average || 0, sources: gradedPrices.bgs7?.sources, confidence: 'high' as const, last_sale_date: null, population: population['bgs-7'] || null },
    // TAG
    { grade: '10' as const, grading_company: 'tag' as const, price: gradedPrices.tag10?.average || 0, sources: gradedPrices.tag10?.sources, confidence: 'medium' as const, last_sale_date: null, population: population['tag-10'] || null },
    { grade: '9' as const, grading_company: 'tag' as const, price: gradedPrices.tag9?.average || 0, sources: gradedPrices.tag9?.sources, confidence: 'high' as const, last_sale_date: null, population: population['tag-9'] || null },
    { grade: '8' as const, grading_company: 'tag' as const, price: gradedPrices.tag8?.average || 0, sources: gradedPrices.tag8?.sources, confidence: 'high' as const, last_sale_date: null, population: population['tag-8'] || null },
    { grade: '7' as const, grading_company: 'tag' as const, price: gradedPrices.tag7?.average || 0, sources: gradedPrices.tag7?.sources, confidence: 'high' as const, last_sale_date: null, population: population['tag-7'] || null },
    // ARS
    { grade: '10+' as const, grading_company: 'ars' as const, price: gradedPrices.ars10plus?.average || 0, sources: gradedPrices.ars10plus?.sources, confidence: 'medium' as const, last_sale_date: null, population: population['ars-10plus'] || null },
    { grade: '10' as const, grading_company: 'ars' as const, price: gradedPrices.ars10?.average || 0, sources: gradedPrices.ars10?.sources, confidence: 'medium' as const, last_sale_date: null, population: population['ars-10'] || null },
    { grade: '9' as const, grading_company: 'ars' as const, price: gradedPrices.ars9?.average || 0, sources: gradedPrices.ars9?.sources, confidence: 'high' as const, last_sale_date: null, population: population['ars-9'] || null },
    { grade: '8' as const, grading_company: 'ars' as const, price: gradedPrices.ars8?.average || 0, sources: gradedPrices.ars8?.sources, confidence: 'high' as const, last_sale_date: null, population: population['ars-8'] || null },
  ].filter(e => e.price > 0);

  const availableGrades = priceLadderEntries.map(c => ({
    grade: c.grade,
    grading_company: c.grading_company,
    hasData: true
  }));

  const latestPricesList = Object.entries(sourcePrices)
    .flatMap(([source, data]) => {
      if (!data || typeof data.usd !== 'number' || !Number.isFinite(data.usd)) return [];
      return [{
        source,
        price: data.usd,
        date: data.recorded_at ?? '',
        kind: data.kind,
      }];
    })
    .sort((a, b) => a.price - b.price);

  // Freshness of the newest price we hold, so the page states how current it is
  // instead of asserting a hardcoded "Availability: High".
  //
  const newestHistoryAt = priceHistoryData.reduce<string | null>((newest, item) => {
    const itemTime = Date.parse(item.recorded_at);
    if (!Number.isFinite(itemTime)) return newest;

    if (!newest || itemTime > Date.parse(newest)) return item.recorded_at;
    return newest;
  }, null);
  const newestPriceAt = latestRecordedAt(sourcePrices) ?? newestHistoryAt;
  // The label itself is computed client-side — at revalidate=86400 a server-rendered
  // relative time would freeze into the cached payload for up to a day.

  // Vendor URLs are stored per card and drive the scrapers; reuse them so each
  // Compared-source rows link out to the listing the price came from.
  const marketUrls: Record<string, string> = {};
  for (const [source, url] of Object.entries({
    tcgplayer: cardData.tcgplayer_url,
    snkrdunk: cardData.snkrdunk_url,
    yuyutei: cardData.yuyutei_url,
    cardrush: cardData.cardrush_url,
  })) {
    if (url) marketUrls[source] = url;
  }

  // Also merge any new mapping records
  if (cardData.card_source_mapping) {
    for (const mapping of cardData.card_source_mapping) {
      if (mapping.external_url) {
        marketUrls[mapping.source] = mapping.external_url;
      }
    }
  }

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

              <div className="mt-8">
                <CardDetailActions
                  cardId={card.id}
                  cardName={cleanName}
                  defaultGrade={activeGradeForChart}
                />
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
              {printRunInfo?.tcgplayer_card_name && (
                <p className="text-zinc-400 font-medium text-xs mt-1 bg-white/10 inline-block px-2 py-0.5 rounded-sm">
                  TCGPlayer: <span className="text-zinc-300">{printRunInfo.tcgplayer_card_name}</span>
                </p>
              )}
            </div>

            {/* Price */}
            <div>
              <p className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-2 flex items-center">
                {priceKindLabel(featuredKind)} ({gradeLabel})
                {winningSource && <span className="ml-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 tracking-wider">Source: {winningSource}</span>}
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

            {/* Card text. Already fetched but never rendered until now — it is the only
                non-price content on the page and gives the URL something to rank on. */}
            {card.description && (
              <div className="bg-[#0b1329]/80 backdrop-blur-sm rounded-2xl border border-white/10 p-5 lg:p-6">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Card Text</h2>
                <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line">{card.description}</p>
              </div>
            )}

            {/* Pulse / Quick Stats */}
            <div className="grid grid-cols-3 divide-x divide-white/10 bg-[#0b1329]/80 backdrop-blur-sm rounded-2xl border border-white/10 py-4 lg:py-6 px-2">
              <div className="px-4 flex flex-col items-center text-center">
                <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">PSA 10 Pop</span>
                <span className="text-2xl font-black text-white tabular-nums">{psa10Pop > 0 ? formatNumber(psa10Pop) : '--'}</span>
                <span className="text-zinc-500 text-[10px] mt-1 font-medium">{totalPop > 0 ? formatNumber(totalPop) : '--'} total</span>
              </div>
              <div className="px-4 flex flex-col items-center text-center">
                <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">Price Sources</span>
                <span className="text-2xl font-black text-white tabular-nums">{latestPricesList.length > 0 ? latestPricesList.length : '--'}</span>
                <span className="text-zinc-500 text-[10px] mt-1 font-medium">Current snapshot</span>
              </div>
              <div className="px-4 flex flex-col items-center text-center">
                <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">Last Updated</span>
                <PriceFreshness newestPriceAt={newestPriceAt} />
                <span className="text-zinc-500 text-[10px] mt-1 font-medium">
                  {latestPricesList.length > 0
                    ? `${latestPricesList.length} source${latestPricesList.length === 1 ? '' : 's'}`
                    : 'No sources yet'}
                </span>
              </div>
            </div>

          </div>

          {/* Column 3: Chart & Stats (col-span-5) */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            <CollectrChart
              priceHistory={priceHistoryData}
              gradeInfos={priceLadderEntries}
              marketUrls={marketUrls}
            />
          </div>
        </div>

        <RelatedCards
          cards={relatedCards}
          gameSlug={game}
          setSlug={set}
          setName={card.set.name}
        />
      </div>
    </div>
  );
}
