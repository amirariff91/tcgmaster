import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/client';
import { getCardWithPrices, getStaleCardPrices } from '@/lib/ppt/service';

interface PopulationReport {
  cardName: string;
  setName: string;
  gradingCompany: 'psa' | 'bgs' | 'cgc' | 'sgc';
  totalPopulation: number;
  populations: Array<{ grade: number; count: number; gemRate: number | null }>;
  scrapedAt: string;
  sourceUrl: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
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
  lore: string | null;
  print_run_info: Record<string, unknown> | null;
  last_price_fetch: string | null;
  sets: SetData;
  card_variants: CardVariant[];
  card_price_current: CurrentPriceData | null;
}

interface SetData {
  id: string;
  name: string;
  slug: string;
  release_date: string | null;
  card_count: number | null;
  games: GameData;
}

interface GameData {
  id: string;
  name: string;
  slug: string;
  display_name: string;
}

interface CardVariant {
  id: string;
  variant_type: string;
  name: string;
  slug: string;
}

interface CurrentPriceData {
  source_prices: Record<string, unknown>;
  graded_prices: Record<string, unknown>;
  headline_cents: number | null;
  headline_source: string | null;
  headline_kind: string | null;
  headline_currency: string | null;
  headline_grade: string | null;
  computed_at: string;
}

type RawPrices = Record<string, number | null>;

async function getPopulationFromPostgres(
  cardId: string,
  gradingCompany: PopulationReport['gradingCompany'],
): Promise<PopulationReport | null> {
  const rows = await dbQuery<{
    grade: number;
    count: number;
    gem_rate: number | null;
    total_population: number | null;
    scraped_at: string | null;
    source_url: string | null;
    card_name: string;
    company_slug: PopulationReport['gradingCompany'];
  }>(`
    SELECT
      pr.grade,
      pr.count,
      pr.gem_rate,
      pr.total_population,
      pr.scraped_at,
      pr.source_url,
      c.name AS card_name,
      gc.slug AS company_slug
    FROM population_reports pr
    JOIN cards c ON c.id = pr.card_id
    JOIN grading_companies gc ON gc.id = pr.grading_company_id
    WHERE pr.card_id = $1
      AND gc.slug = $2
    ORDER BY pr.grade
  `, [cardId, gradingCompany]);

  const first = rows[0];
  if (!first) return null;

  return {
    cardName: first.card_name,
    setName: '',
    gradingCompany: first.company_slug,
    totalPopulation: first.total_population ?? 0,
    populations: rows.map((row) => ({
      grade: row.grade,
      count: row.count,
      gemRate: row.gem_rate,
    })),
    scrapedAt: first.scraped_at ?? '',
    sourceUrl: first.source_url ?? '',
  };
}

function getNumericRawPrices(sourcePrices: Record<string, unknown> | null | undefined): RawPrices {
  const rawPrices: RawPrices = {};

  for (const [source, metadata] of Object.entries(sourcePrices || {})) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) continue;

    const usd = (metadata as { usd?: unknown }).usd;
    if (typeof usd === 'number' && Number.isFinite(usd)) {
      rawPrices[source] = usd;
    }
  }

  return rawPrices;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Determine if id is a UUID or a tcg_player_id
  const isUUID = id.includes('-') && id.length === 36;

  let card: CardData | null = null;
  try {
    const rows = await dbQuery<CardData>(`
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
        c.lore,
        c.print_run_info,
        c.last_price_fetch,
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
            'headline_grade', cp.headline_grade,
            'computed_at', cp.computed_at
          )
          FROM card_price_current cp
          WHERE cp.card_id = c.id
        ) AS card_price_current
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      JOIN games g ON g.id = s.game_id
      WHERE ${isUUID ? 'c.id' : 'c.tcg_player_id'} = $1
      LIMIT 1
    `, [id]);

    card = rows[0] || null;
  } catch (error) {
    console.error('Error fetching card:', error);
    return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 });
  }

  if (!card) {
    return NextResponse.json(
      { error: 'Card not found' },
      { status: 404 }
    );
  }

  // Get cached population data without routing this public read through the scraper.
  let population: PopulationReport | null = null;
  try {
    population = await getPopulationFromPostgres(card.id, 'psa');
  } catch (error) {
    console.error('Error fetching cached population:', error);
  }

  // The current-price row is keyed by card_id; there is no legacy expiry row to unwrap.
  const currentPrice = card.card_price_current;
  const isStale = currentPrice === null || (
    currentPrice.headline_cents === null &&
    Object.keys(currentPrice.graded_prices || {}).length === 0
  );

  // If we have a tcg_player_id and data is stale, try to refresh
  let prices: {
    raw: RawPrices;
    graded: Record<string, unknown>;
    ebay: Record<string, unknown>;
  } = {
    raw: getNumericRawPrices(currentPrice?.source_prices),
    graded: (currentPrice?.graded_prices || {}) as Record<string, unknown>,
    ebay: {},
  };
  let usingDatabasePrices = currentPrice !== null;
  let fromCache = true;
  let staleHours: number | null = null;

  if (isStale && card.tcg_player_id) {
    try {
      const freshData = await getCardWithPrices(card.tcg_player_id, {
        includeEbay: true,
      });

      if (freshData) {
        prices = {
          raw: freshData.prices.raw,
          graded: freshData.prices.graded,
          ebay: {},
        };
        usingDatabasePrices = false;
        fromCache = freshData.fromCache;
      }
    } catch {
      // Fall back to stale data
      const staleData = await getStaleCardPrices(card.tcg_player_id);
      if (staleData) {
        staleHours = staleData.hoursStale;
      }
    }
  }

  const set = card.sets;
  const game = set?.games;

  const response = {
    data: {
      id: card.id,
      name: card.name,
      slug: card.slug,
      number: card.number,
      rarity: card.rarity,
      artist: card.artist,
      description: card.description,
      imageUrl: card.local_image_url || card.image_url,
      lore: card.lore,
      printRunInfo: card.print_run_info,
      tcgPlayerId: card.tcg_player_id,
      set: {
        id: set?.id,
        name: set?.name,
        slug: set?.slug,
        releaseDate: set?.release_date,
        cardCount: set?.card_count,
      },
      game: {
        id: game?.id,
        name: game?.name,
        slug: game?.slug,
        displayName: game?.display_name,
      },
      variants: card.card_variants || [],
      prices: {
        raw: prices.raw,
        graded: prices.graded,
        ...(usingDatabasePrices ? { sourcePrices: currentPrice?.source_prices || {} } : {}),
        fromCache,
        staleHours,
        lastUpdated: currentPrice?.computed_at,
      },
      population: population ? {
        gradingCompany: population.gradingCompany,
        totalPopulation: population.totalPopulation,
        byGrade: population.populations,
      } : null,
    },
  };

  return NextResponse.json(response);
}
