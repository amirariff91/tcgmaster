/**
 * Search Service
 * Combines NLP parsing with database queries
 */

import { createServerClient } from '@/lib/supabase/client';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';
import { parseSearchQuery, scoreCardMatch, ParsedQuery } from './nlp-parser';

// Type definitions for Supabase query results
interface CardSearchRow {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity: string | null;
  image_url: string | null;
  local_image_url: string | null;
  sets: {
    id: string;
    name: string;
    slug: string;
    games: { slug: string };
  };
  price_cache: Array<{
    raw_prices: Record<string, number> | null;
  }> | null;
}

interface CardSuggestionRow {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity: string | null;
  image_url: string | null;
  local_image_url: string | null;
  sets: {
    name: string;
    slug: string;
    games: { slug: string };
  };
}

interface SetRow {
  name: string;
  slug: string;
  card_count: number | null;
}

interface SearchAnalyticsRow {
  search_query: string;
}

export interface SearchResult {
  id: string;
  name: string;
  setName: string;
  setSlug: string;
  number: string;
  rarity: string | null;
  imageUrl: string | null;
  marketPrice: number | null;
  slug: string;
  game: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  parsed: ParsedQuery;
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface SearchOptions {
  page?: number;
  pageSize?: number;
  filters?: {
    game?: string;
    set?: string;
    rarity?: string;
    minPrice?: number;
    maxPrice?: number;
    gradingCompany?: string;
    grade?: number;
  };
}

/**
 * Perform a full-text search with NLP parsing
 */
export async function searchCards(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const supabase = createServerClient();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Parse the query using NLP
  const parsed = parseSearchQuery(query);

  // Check cache first
  const cacheKey = CACHE_KEYS.search(JSON.stringify({ query, options }));
  const cached = await redis.get<SearchResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  // Build the database query
  let dbQuery = supabase
    .from('cards')
    .select(`
      id,
      name,
      slug,
      number,
      rarity,
      image_url,
      local_image_url,
      sets!inner (
        id,
        name,
        slug,
        games!inner (
          slug
        )
      ),
      price_cache (
        raw_prices
      )
    `, { count: 'exact' });

  // Apply text search
  if (parsed.cardName) {
    // Use trigram search for fuzzy matching
    dbQuery = dbQuery.ilike('name', `%${parsed.cardName}%`);
  }

  // Apply set filter from parsed query or options
  if (parsed.setName) {
    dbQuery = dbQuery.ilike('sets.name', `%${parsed.setName}%`);
  } else if (options.filters?.set) {
    dbQuery = dbQuery.eq('sets.slug', options.filters.set);
  }

  // Apply game filter
  if (options.filters?.game) {
    dbQuery = dbQuery.eq('sets.games.slug', options.filters.game);
  }

  // Apply rarity filter
  if (parsed.rarity || options.filters?.rarity) {
    const rarity = parsed.rarity || options.filters?.rarity;
    dbQuery = dbQuery.ilike('rarity', `%${rarity}%`);
  }

  // Execute query with pagination
  const { data: cards, count, error } = await dbQuery
    .range(offset, offset + pageSize - 1)
    .order('name');

  if (error) {
    console.error('Search error:', error);
    throw new Error('Search failed');
  }

  // Transform and score results
  const typedCards = cards as CardSearchRow[] | null;
  const results: SearchResult[] = (typedCards || []).map((card) => {
    const set = Array.isArray(card.sets) ? card.sets[0] : card.sets;
    const game = set?.games;
    const priceCache = Array.isArray(card.price_cache) ? card.price_cache[0] : card.price_cache;
    const rawPrices = priceCache?.raw_prices;

    const result: SearchResult = {
      id: card.id,
      name: card.name,
      setName: set?.name || '',
      setSlug: set?.slug || '',
      number: card.number,
      rarity: card.rarity,
      imageUrl: card.local_image_url || card.image_url,
      marketPrice: rawPrices?.nearMint ?? null,
      slug: card.slug,
      game: game?.slug || 'pokemon',
      score: 0,
    };

    // Calculate match score
    result.score = scoreCardMatch(
      {
        name: card.name,
        setName: set?.name,
        rarity: card.rarity || undefined,
      },
      parsed
    );

    return result;
  });

  // Sort by score (descending), then by name
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  const response: SearchResponse = {
    results,
    parsed,
    totalCount: count || 0,
    page,
    pageSize,
    hasMore: (count || 0) > offset + pageSize,
  };

  // Cache the results
  await redis.set(cacheKey, response, { ex: CACHE_TTL.search });

  // Track search analytics (async, don't wait)
  trackSearchAnalytics(query, parsed, results.length).catch(console.error);

  return response;
}

/**
 * Get autocomplete suggestions for a partial query
 */
export async function getSearchSuggestions(
  query: string,
  limit: number = 8
): Promise<{
  cards: SearchResult[];
  sets: Array<{ name: string; slug: string; cardCount: number }>;
  suggestions: string[];
}> {
  const supabase = createServerClient();

  if (query.length < 2) {
    return { cards: [], sets: [], suggestions: [] };
  }

  // Search cards
  const { data: cards } = await supabase
    .from('cards')
    .select(`
      id,
      name,
      slug,
      number,
      rarity,
      image_url,
      local_image_url,
      sets!inner (
        name,
        slug,
        games!inner (slug)
      )
    `)
    .ilike('name', `%${query}%`)
    .limit(limit);

  // Search sets
  const { data: sets } = await supabase
    .from('sets')
    .select('name, slug, card_count')
    .ilike('name', `%${query}%`)
    .limit(4);

  // Get NLP suggestions
  const parsed = parseSearchQuery(query);
  const nlpSuggestions = parsed.suggestions;

  const typedCards = cards as CardSuggestionRow[] | null;
  const typedSets = sets as SetRow[] | null;

  return {
    cards: (typedCards || []).map((card) => {
      const set = Array.isArray(card.sets) ? card.sets[0] : card.sets;
      const game = set?.games;

      return {
        id: card.id,
        name: card.name,
        setName: set?.name || '',
        setSlug: set?.slug || '',
        number: card.number,
        rarity: card.rarity,
        imageUrl: card.local_image_url || card.image_url,
        marketPrice: null,
        slug: card.slug,
        game: game?.slug || 'pokemon',
        score: 0,
      };
    }),
    sets: (typedSets || []).map((set) => ({
      name: set.name,
      slug: set.slug,
      cardCount: set.card_count || 0,
    })),
    suggestions: nlpSuggestions,
  };
}

/**
 * Get popular/trending searches
 */
export async function getPopularSearches(
  limit: number = 10
): Promise<string[]> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('search_analytics')
    .select('search_query')
    .eq('result_clicked', true)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (!data || data.length === 0) {
    return [];
  }

  const typedData = data as SearchAnalyticsRow[];

  // Count occurrences
  const counts = new Map<string, number>();
  for (const row of typedData) {
    const query = row.search_query.toLowerCase().trim();
    counts.set(query, (counts.get(query) || 0) + 1);
  }

  // Sort by count and return top queries
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([query]) => query);
}

/**
 * Track search analytics
 */
async function trackSearchAnalytics(
  query: string,
  parsed: ParsedQuery,
  resultCount: number
): Promise<void> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('search_analytics') as any).insert({
    search_query: query,
    result_clicked: resultCount > 0,
  });
}

/**
 * Record when a user clicks a search result
 */
export async function trackSearchClick(
  searchQuery: string,
  cardId: string,
  userId?: string
): Promise<void> {
  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('search_analytics') as any).insert({
    search_query: searchQuery,
    card_id: cardId,
    user_id: userId,
    result_clicked: true,
  });
}
