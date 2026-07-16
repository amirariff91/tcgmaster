import fs from 'fs';

const filePath = 'lib/search/service.ts';
let content = fs.readFileSync(filePath, 'utf8');

const searchCardsStart = content.indexOf('export async function searchCards(');
const searchCardsEnd = content.indexOf('export async function getSearchSuggestions(');

const newSearchCards = `export async function searchCards(
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
        parsed: {
          originalQuery: query,
          cardName: null,
          setName: null,
          rarity: null,
          suggestions: [],
        },
        pagination: {
          hasMore: false,
          totalCount: 24,
        },
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
      : \`
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
        \`;
        
    let dbQuery = supabase.from('cards').select(columns, { count: 'exact', head });

    // Apply text search
    if (parsed.cardName && parsed.cardName.length >= 2) {
      dbQuery = dbQuery.ilike('name', \`%\${parsed.cardName}%\`);
    }

    // Apply set filter
    if (parsed.setName) {
      dbQuery = dbQuery.ilike('sets.name', \`%\${parsed.setName}%\`);
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
      dbQuery = dbQuery.ilike('rarity', \`%\${rarity}%\`);
    }

    // Apply language filter
    if (options.filters?.lang === 'en') {
      dbQuery = dbQuery.not('tcg_player_id', 'is', null);
    } else if (options.filters?.lang === 'ja') {
      dbQuery = dbQuery.is('tcg_player_id', null);
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

  // 3. Fetch Incomplete Cards (if more items needed to fill the page)
  if (completeCards.length < pageSize) {
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

`;

content = content.substring(0, searchCardsStart) + newSearchCards + content.substring(searchCardsEnd);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done refactoring');
