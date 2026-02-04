/**
 * Trending Score Calculator
 * Implements the combined weighted scoring algorithm
 */

import { createServerClient } from '@/lib/supabase/client';
import { redis } from '@/lib/redis/client';

// Type definitions for Supabase query results
interface TrendingScoreRow {
  card_id: string;
  price_change_24h: number;
  volume_24h: number;
  search_count_24h: number;
  social_mentions_24h: number;
  combined_score: number;
  cards: {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
    local_image_url: string | null;
    sets: {
      name: string;
      slug: string;
      games: { slug: string };
    };
  };
}

interface CardIdRow {
  id: string;
}

interface PriceHistoryRow {
  price: number;
  recorded_at: string;
}

// Weights for trending score calculation
const WEIGHTS = {
  priceChange: 0.3,
  volume: 0.25,
  searches: 0.25,
  social: 0.2,
};

export interface TrendingCard {
  cardId: string;
  cardName: string;
  setName: string;
  setSlug: string;
  slug: string;
  imageUrl: string | null;
  currentPrice: number | null;
  priceChange24h: number;
  volume24h: number;
  searchCount24h: number;
  socialMentions24h: number;
  combinedScore: number;
  game: string;
}

/**
 * Calculate trending score for a card
 */
export function calculateTrendingScore(
  priceChange24h: number,
  volume24h: number,
  searchCount24h: number,
  socialMentions24h: number
): number {
  // Normalize values (these would be tuned based on real data)
  const normalizedPrice = Math.min(Math.abs(priceChange24h) / 50, 1); // Cap at 50% change
  const normalizedVolume = Math.min(volume24h / 100, 1); // Cap at 100 sales
  const normalizedSearches = Math.min(searchCount24h / 1000, 1); // Cap at 1000 searches
  const normalizedSocial = Math.min(socialMentions24h / 50, 1); // Cap at 50 mentions

  return (
    normalizedPrice * WEIGHTS.priceChange +
    normalizedVolume * WEIGHTS.volume +
    normalizedSearches * WEIGHTS.searches +
    normalizedSocial * WEIGHTS.social
  );
}

/**
 * Get top trending cards
 */
export async function getTrendingCards(
  limit: number = 10,
  game?: string
): Promise<TrendingCard[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('trending_scores')
    .select(`
      card_id,
      price_change_24h,
      volume_24h,
      search_count_24h,
      social_mentions_24h,
      combined_score,
      cards!inner (
        id,
        name,
        slug,
        image_url,
        local_image_url,
        sets!inner (
          name,
          slug,
          games!inner (slug)
        )
      )
    `)
    .order('combined_score', { ascending: false })
    .limit(limit);

  if (game) {
    query = query.eq('cards.sets.games.slug', game);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching trending cards:', error);
    return [];
  }

  const typedData = data as TrendingScoreRow[] | null;

  return (typedData || []).map((row) => {
    const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
    const set = card?.sets;
    const gameData = set?.games;

    return {
      cardId: row.card_id,
      cardName: card?.name || '',
      setName: set?.name || '',
      setSlug: set?.slug || '',
      slug: card?.slug || '',
      imageUrl: card?.local_image_url || card?.image_url || null,
      currentPrice: null, // Would need to join price_cache
      priceChange24h: row.price_change_24h,
      volume24h: row.volume_24h,
      searchCount24h: row.search_count_24h,
      socialMentions24h: row.social_mentions_24h,
      combinedScore: row.combined_score,
      game: gameData?.slug || 'pokemon',
    };
  });
}

/**
 * Get market movers (biggest gainers and losers)
 */
export async function getMarketMovers(
  limit: number = 5
): Promise<{
  gainers: TrendingCard[];
  losers: TrendingCard[];
}> {
  const supabase = createServerClient();

  // Get biggest gainers
  const { data: gainersData } = await supabase
    .from('trending_scores')
    .select(`
      card_id,
      price_change_24h,
      volume_24h,
      search_count_24h,
      social_mentions_24h,
      combined_score,
      cards!inner (
        id,
        name,
        slug,
        image_url,
        local_image_url,
        sets!inner (name, slug, games!inner (slug))
      )
    `)
    .gt('price_change_24h', 0)
    .order('price_change_24h', { ascending: false })
    .limit(limit);

  // Get biggest losers
  const { data: losersData } = await supabase
    .from('trending_scores')
    .select(`
      card_id,
      price_change_24h,
      volume_24h,
      search_count_24h,
      social_mentions_24h,
      combined_score,
      cards!inner (
        id,
        name,
        slug,
        image_url,
        local_image_url,
        sets!inner (name, slug, games!inner (slug))
      )
    `)
    .lt('price_change_24h', 0)
    .order('price_change_24h', { ascending: true })
    .limit(limit);

  const mapToTrending = (row: TrendingScoreRow): TrendingCard => {
    const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
    const set = card?.sets;
    const gameData = set?.games;

    return {
      cardId: row.card_id,
      cardName: card?.name || '',
      setName: set?.name || '',
      setSlug: set?.slug || '',
      slug: card?.slug || '',
      imageUrl: card?.local_image_url || card?.image_url || null,
      currentPrice: null,
      priceChange24h: row.price_change_24h,
      volume24h: row.volume_24h,
      searchCount24h: row.search_count_24h,
      socialMentions24h: row.social_mentions_24h,
      combinedScore: row.combined_score,
      game: gameData?.slug || 'pokemon',
    };
  };

  const typedGainers = gainersData as TrendingScoreRow[] | null;
  const typedLosers = losersData as TrendingScoreRow[] | null;

  return {
    gainers: (typedGainers || []).map(mapToTrending),
    losers: (typedLosers || []).map(mapToTrending),
  };
}

/**
 * Update trending scores for all cards
 * Called by Inngest job
 */
export async function updateAllTrendingScores(): Promise<{
  updated: number;
  errors: string[];
}> {
  const supabase = createServerClient();
  const errors: string[] = [];
  let updated = 0;

  try {
    // Get all cards with recent activity
    const { data: cardsData } = await supabase
      .from('cards')
      .select('id')
      .not('last_price_fetch', 'is', null);

    const cards = cardsData as CardIdRow[] | null;

    if (!cards || cards.length === 0) {
      return { updated: 0, errors: [] };
    }

    // Calculate metrics for each card
    for (const card of cards) {
      try {
        // Get price change from history
        const { data: priceHistoryData } = await supabase
          .from('price_history')
          .select('price, recorded_at')
          .eq('card_id', card.id)
          .order('recorded_at', { ascending: false })
          .limit(2);

        const priceHistory = priceHistoryData as PriceHistoryRow[] | null;

        let priceChange24h = 0;
        if (priceHistory && priceHistory.length >= 2) {
          const latest = priceHistory[0].price;
          const previous = priceHistory[1].price;
          priceChange24h = ((latest - previous) / previous) * 100;
        }

        // Get volume from price history (count of records in last 24h)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: volume24h } = await supabase
          .from('price_history')
          .select('*', { count: 'exact', head: true })
          .eq('card_id', card.id)
          .gte('recorded_at', yesterday);

        // Get search count from analytics
        const { count: searchCount24h } = await supabase
          .from('search_analytics')
          .select('*', { count: 'exact', head: true })
          .eq('card_id', card.id)
          .gte('created_at', yesterday);

        // Social mentions would come from external API
        const socialMentions24h = 0;

        // Calculate combined score
        const combinedScore = calculateTrendingScore(
          priceChange24h,
          volume24h || 0,
          searchCount24h || 0,
          socialMentions24h
        );

        // Upsert trending score
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('trending_scores') as any)
          .upsert({
            card_id: card.id,
            price_change_24h: priceChange24h,
            volume_24h: volume24h || 0,
            search_count_24h: searchCount24h || 0,
            social_mentions_24h: socialMentions24h,
            combined_score: combinedScore,
            calculated_at: new Date().toISOString(),
          }, {
            onConflict: 'card_id',
          });

        updated++;
      } catch (err) {
        errors.push(`Card ${card.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Cache trending results
    const trending = await getTrendingCards(20);
    await redis.set('trending:cards', trending, { ex: 15 * 60 }); // 15 min cache

  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { updated, errors };
}
