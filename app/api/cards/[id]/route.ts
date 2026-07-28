import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/client';
import { getCardWithPrices, getStaleCardPrices } from '@/lib/ppt/service';
import { getPopulationFromDb } from '@/lib/scrapers/gemrate';

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

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = createPublicClient();

  // Determine if id is a UUID or a tcg_player_id
  const isUUID = id.includes('-') && id.length === 36;

  // Fetch card from database
  const query = supabase
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
      lore,
      print_run_info,
      last_price_fetch,
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
      card_price_current (
        source_prices,
        graded_prices,
        headline_cents,
        headline_source,
        headline_kind,
        headline_currency,
        headline_grade,
        computed_at
      )
    `);

  if (isUUID) {
    query.eq('id', id);
  } else {
    query.eq('tcg_player_id', id);
  }

  const { data: cardData, error } = await query.single();

  const card = cardData as CardData | null;

  if (error || !card) {
    return NextResponse.json(
      { error: 'Card not found' },
      { status: 404 }
    );
  }

  // Get population data
  const population = await getPopulationFromDb(card.id, 'psa');

  // The current-price row is keyed by card_id; there is no legacy expiry row to unwrap.
  const currentPrice = card.card_price_current;
  const isStale = !currentPrice;

  // If we have a tcg_player_id and data is stale, try to refresh
  let prices = {
    raw: currentPrice?.source_prices || {},
    graded: currentPrice?.graded_prices || {},
    ebay: {},
  };
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
        fromCache = freshData.fromCache;
      }
    } catch (err) {
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
