/**
 * Search Service
 * Combines NLP parsing with database queries
 */

import { createPublicClient, createServerClient } from '@/lib/supabase/client';
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
  price_cache_ttl: number | null;
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
  sort?: string;
  filters?: {
    game?: string;
    set?: string;
    rarity?: string;
    minPrice?: number;
    maxPrice?: number;
    gradingCompany?: string;
    grade?: number;
    lang?: 'en' | 'ja' | 'all';
  };
}

/**
 * Perform a full-text search with NLP parsing
 */
export async function searchCards(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const supabase = createPublicClient();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Intercept completely empty queries (Trending view)
  const isDefaultView = !query && !options.filters?.game && !options.filters?.set && !options.filters?.rarity && (!options.sort || options.sort === 'relevance');
  if (isDefaultView) {
    if (page === 1) {
      const trending = await redis.get<SearchResponse>('api:search:trending');
      if (trending) {
        return trending;
      }
    } else {
      return {
        results: [],
        parsed: parseSearchQuery(query),
        totalCount: 24,
        page,
        pageSize,
        hasMore: false,
      };
    }
  }

  // Parse the query using NLP
  const parsed = parseSearchQuery(query);

  // Check cache first
  const cacheKey = CACHE_KEYS.search(JSON.stringify({ query, options }));
  const cached = await redis.get<SearchResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  // Helper to build the base query with all filters applied
  const buildBaseQuery = (head: boolean = false) => {
    const columns = head 
      ? 'id, sets!inner ( games!inner ( slug ) )'
      : `
          id,
          name,
          slug,
          number,
          rarity,
          image_url,
          local_image_url,
          price_cache_ttl,
          sets!inner (
            id,
            name,
            slug,
            games!inner (
              slug
            )
          )
        `;
        
    let dbQuery = supabase.from('cards').select(columns, { count: 'exact', head });

    // Apply text search
    if (parsed.cardName && parsed.cardName.length >= 2) {
      dbQuery = dbQuery.or(`name.ilike.%${parsed.cardName}%,number.ilike.%${parsed.cardName}%`);
    }

    // Apply set filter
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

    // Apply language filter
    if (options.filters?.lang === 'en') {
      dbQuery = dbQuery.not('slug', 'ilike', '%-ja');
    } else if (options.filters?.lang === 'ja') {
      dbQuery = dbQuery.ilike('slug', '%-ja');
    }

    // Filter out cards with no prices when sorting by "Recently Updated"
    // so that failed scraper attempts don't bubble to the top
    if (options.sort === 'recent') {
      dbQuery = dbQuery.not('price_cache_ttl', 'is', null);
    }

    return dbQuery;
  };

  // Helper to apply sorting
  const applySort = (q: any) => {
    if (options.sort === 'price-desc') {
      return q.order('price_cache_ttl', { ascending: false, nullsFirst: false });
    } else if (options.sort === 'price-asc') {
      return q.order('price_cache_ttl', { ascending: true, nullsFirst: false });
    } else if (options.sort === 'name-asc') {
      return q.order('name', { ascending: true });
    } else {
      return q.order('last_price_fetch', { ascending: false, nullsFirst: false }).order('name');
    }
  };

  // 1. Get total count and complete count
  const { count: totalCount } = await buildBaseQuery(true);
  const { count: completeCount } = await buildBaseQuery(true).not('image_url', 'is', null);

  const safeTotalCount = totalCount || 0;
  const safeCompleteCount = completeCount || 0;

  let completeCards: CardSearchRow[] = [];
  let incompleteCards: CardSearchRow[] = [];

  // 2. Fetch Complete Cards (if within range)
  if (offset < safeCompleteCount) {
    const completeFetchSize = Math.min(pageSize, safeCompleteCount - offset);
    
    // If a custom sort is applied, don't split by image! Query all!
    const isCustomSort = options.sort && options.sort !== 'relevance';
    
    if (isCustomSort) {
      let qAll = buildBaseQuery(false);
      qAll = applySort(qAll);
      qAll = qAll.range(offset, offset + pageSize - 1);
      
      const { data, error } = await qAll;
      if (error) {
        console.error('Search error (All):', error);
        throw new Error('Search failed');
      }
      completeCards = (data as unknown as CardSearchRow[]) || [];
    } else {
      let qComplete = buildBaseQuery(false).not('image_url', 'is', null);
      qComplete = applySort(qComplete);
      qComplete = qComplete.range(offset, offset + completeFetchSize - 1);
      
      const { data, error } = await qComplete;
      if (error) {
        console.error('Search error (Complete):', error);
        throw new Error('Search failed');
      }
      completeCards = (data as unknown as CardSearchRow[]) || [];
    }
  }

  // 3. Fetch Incomplete Cards (if more items needed to fill the page)
  if (completeCards.length < pageSize) {
    const isCustomSort = options.sort && options.sort !== 'relevance';
    
    if (!isCustomSort) {
      const remainingSize = pageSize - completeCards.length;
      const incompleteOffset = Math.max(0, offset - safeCompleteCount);
      
      let qIncomplete = buildBaseQuery(false).is('image_url', null);
      qIncomplete = applySort(qIncomplete);
      qIncomplete = qIncomplete.range(incompleteOffset, incompleteOffset + remainingSize - 1);
      
      const { data, error } = await qIncomplete;
      if (error) {
        console.error('Search error (Incomplete):', error);
        throw new Error('Search failed');
      }
      incompleteCards = (data as unknown as CardSearchRow[]) || [];
    }
  }

  const typedCards = [...completeCards, ...incompleteCards];

  // Transform and score results
  const results: SearchResult[] = typedCards.map((card) => {
    const set = Array.isArray(card.sets) ? card.sets[0] : card.sets;
    const game = set?.games;

    const result: SearchResult = {
      id: card.id,
      name: card.name,
      setName: set?.name || '',
      setSlug: set?.slug || '',
      number: card.number,
      rarity: card.rarity,
      imageUrl: card.local_image_url || card.image_url,
      marketPrice: card.price_cache_ttl ? card.price_cache_ttl / 100 : null,
      slug: card.slug,
      game: game?.slug || 'pokemon',
      score: 0,
    };

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

  // Sort by score (descending), then by name ONLY IF relevance sorting is active
  if (!options.sort || options.sort === 'relevance') {
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });
  }

  const response: SearchResponse = {
    results,
    parsed,
    totalCount: safeTotalCount,
    page,
    pageSize,
    hasMore: safeTotalCount > offset + pageSize,
  };

  // Cache the results
  await redis.set(cacheKey, response, { ex: CACHE_TTL.search });

  // Track search analytics (async, don't wait)
  trackSearchAnalytics(query, parsed, results.length).catch(console.error);

  return response;
}

export async function getSearchSuggestions(
  query: string,
  limit: number = 8
): Promise<{
  cards: SearchResult[];
  sets: Array<{ name: string; slug: string; cardCount: number }>;
  suggestions: string[];
}> {
  const supabase = createPublicClient();

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
    .or(`name.ilike.%${query}%,number.ilike.%${query}%`)
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
  const supabase = createPublicClient();

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
