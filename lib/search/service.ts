/**
 * Search Service
 * Combines NLP parsing with database queries
 */

import { dbQuery } from '@/lib/db/client';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';
import { parseSearchQuery, scoreCardMatch, ParsedQuery } from './nlp-parser';

// Type definitions for Postgres query results
interface CardSearchRow {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity: string | null;
  image_url: string | null;
  local_image_url: string | null;
  headline_cents: number | null;
  sets: {
    id: string;
    name: string;
    slug: string;
    games: { slug: string };
  };
  curation_status: string | null;
}

interface CardSuggestionRow {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity: string | null;
  image_url: string | null;
  local_image_url: string | null;
  headline_cents?: number | null;
  graded_prices?: Record<string, { average?: number; sources?: Record<string, number> }> | null;
  sets: {
    name: string;
    slug: string;
    games: { slug: string };
  };
  curation_status?: string | null;
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
  psa10Price?: number | null;
  slug: string;
  game: string;
  curationStatus: string | null;
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

  const fromClause = `
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
  `;

  const buildFilters = () => {
    const clauses = ['TRUE'];
    const params: unknown[] = [];
    const addParam = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (parsed.isVerifiedOnly) {
      clauses.push(`c.curation_status = ${addParam('curated')}`);
    }

    // High-precision compound search: cardName + cardNumber / setCode
    if (parsed.cardName && (parsed.cardNumber || parsed.rawNumber)) {
      const nameVal = addParam(`%${parsed.cardName}%`);
      const numVal = parsed.cardNumber || parsed.rawNumber;
      const numExact = addParam(numVal);
      const numPrefix = addParam(`${numVal}%`);
      const numHyphen = addParam(`%-${numVal}%`);
      clauses.push(`(c.name ILIKE ${nameVal}) AND (c.number = ${numExact} OR c.number ILIKE ${numPrefix} OR c.number ILIKE ${numHyphen})`);
    } else if (parsed.cardNumber || parsed.rawNumber) {
      const numVal = parsed.cardNumber || parsed.rawNumber;
      const numExact = addParam(numVal);
      const numPrefix = addParam(`${numVal}%`);
      const numHyphen = addParam(`%-${numVal}%`);
      clauses.push(`(c.number = ${numExact} OR c.number ILIKE ${numPrefix} OR c.number ILIKE ${numHyphen} OR c.slug ILIKE ${numHyphen})`);
    } else if (parsed.cardName && parsed.cardName.length >= 2) {
      const value = addParam(`%${parsed.cardName}%`);
      clauses.push(`(c.name ILIKE ${value} OR c.number ILIKE ${value})`);
    }

    if (parsed.setCode) {
      const setCodeVal = addParam(`${parsed.setCode}%`);
      clauses.push(`(s.slug ILIKE ${setCodeVal} OR c.number ILIKE ${setCodeVal})`);
    }

    if (parsed.setName) {
      clauses.push(`s.name ILIKE ${addParam(`%${parsed.setName}%`)}`);
    } else if (options.filters?.set) {
      clauses.push(`s.slug = ${addParam(options.filters.set)}`);
    }

    if (options.filters?.game) {
      clauses.push(`g.slug = ${addParam(options.filters.game)}`);
    }

    if (parsed.rarity || options.filters?.rarity) {
      const rarity = parsed.rarity || options.filters?.rarity;
      clauses.push(`c.rarity ILIKE ${addParam(`%${rarity}%`)}`);
    }

    if (options.filters?.lang === 'en') {
      clauses.push(`c.slug NOT LIKE ${addParam('%-ja')}`);
    } else if (options.filters?.lang === 'ja') {
      clauses.push(`c.slug LIKE ${addParam('%-ja')}`);
    }

    if (options.sort === 'recent') {
      clauses.push('cpc.headline_cents IS NOT NULL');
    }

    return { where: clauses.join(' AND '), params };
  };

  const sortClause = options.sort === 'price-desc'
    ? '(c.image_url IS NOT NULL) DESC, cpc.headline_cents DESC NULLS LAST, c.id'
    : options.sort === 'price-asc'
      ? '(c.image_url IS NOT NULL) DESC, cpc.headline_cents ASC NULLS LAST, c.id'
      : options.sort === 'name-asc'
        ? '(c.image_url IS NOT NULL) DESC, c.name ASC, c.id'
        : options.sort === 'recent'
          ? '(c.image_url IS NOT NULL) DESC, GREATEST(c.last_price_fetch, cpc.computed_at) DESC NULLS LAST, c.id'
          : '(c.image_url IS NOT NULL) DESC, cpc.headline_cents DESC NULLS LAST, c.last_price_fetch DESC NULLS LAST, c.name, c.id';

  const countCards = async (extraWhere = '') => {
    const filters = buildFilters();
    const rows = await dbQuery<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      ${fromClause}
      WHERE ${filters.where}${extraWhere ? ` AND ${extraWhere}` : ''}
    `, filters.params);
    return rows[0]?.count || 0;
  };

  const fetchCards = async (extraWhere: string, limit: number, offset: number) => {
    const filters = buildFilters();
    const limitParam = `$${filters.params.push(limit)}`;
    const offsetParam = `$${filters.params.push(offset)}`;
    return dbQuery<CardSearchRow>(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.number,
        c.rarity,
        c.image_url,
        c.local_image_url,
        cpc.headline_cents,
        c.curation_status,
        json_build_object(
          'id', s.id,
          'name', s.name,
          'slug', s.slug,
          'games', json_build_object('slug', g.slug)
        ) AS sets
      ${fromClause}
      WHERE ${filters.where}${extraWhere ? ` AND ${extraWhere}` : ''}
      ORDER BY ${sortClause}
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `, filters.params);
  };

  // 1. Get total count and complete count.
  const [safeTotalCount, safeCompleteCount] = await Promise.all([
    countCards(),
    countCards('c.image_url IS NOT NULL'),
  ]);

  let completeCards: CardSearchRow[] = [];
  let incompleteCards: CardSearchRow[] = [];

  // 2. Fetch Complete Cards (if within range)
  if (offset < safeCompleteCount) {
    const completeFetchSize = Math.min(pageSize, safeCompleteCount - offset);

    // If a custom sort is applied, don't split by image! Query all!
    const isCustomSort = options.sort && options.sort !== 'relevance';

    if (isCustomSort) {
      completeCards = await fetchCards('', pageSize, offset);
    } else {
      completeCards = await fetchCards('c.image_url IS NOT NULL', completeFetchSize, offset);
    }
  }

  // 3. Fetch Incomplete Cards (if more items needed to fill the page)
  if (completeCards.length < pageSize) {
    const isCustomSort = options.sort && options.sort !== 'relevance';

    if (!isCustomSort) {
      const remainingSize = pageSize - completeCards.length;
      const incompleteOffset = Math.max(0, offset - safeCompleteCount);

      incompleteCards = await fetchCards('c.image_url IS NULL', remainingSize, incompleteOffset);
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
      marketPrice: card.headline_cents != null && card.headline_cents > 0 ? card.headline_cents / 100 : null,
      slug: card.slug,
      game: game?.slug || 'pokemon',
      curationStatus: card.curation_status || null,
      score: 0,
    };

    result.score = scoreCardMatch(
      {
        name: card.name,
        number: card.number,
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
  if (query.length < 2) {
    return { cards: [], sets: [], suggestions: [] };
  }

  // Parse structured components using NLP Tokenizer
  const parsed = parseSearchQuery(query);

  let cardWhere = '';
  let cardParams: unknown[] = [];

  if (parsed.cardName && (parsed.cardNumber || parsed.rawNumber)) {
    // Compound intent: name + card number (e.g. "Luffy 119", "Zamazenta 232")
    const numVal = parsed.cardNumber || parsed.rawNumber;
    cardParams = [`%${parsed.cardName}%`, numVal, `${numVal}%`, `%-${numVal}%`];
    cardWhere = `c.name ILIKE $1 AND (c.number = $2 OR c.number ILIKE $3 OR c.number ILIKE $4)`;
  } else if (parsed.cardNumber || parsed.rawNumber) {
    // Exact or prefix number search (e.g. "OP05-119", "232/172", "#113")
    const numVal = parsed.cardNumber || parsed.rawNumber;
    cardParams = [numVal, `${numVal}%`, `%-${numVal}%`];
    cardWhere = `c.number = $1 OR c.number ILIKE $2 OR c.number ILIKE $3 OR c.slug ILIKE $3`;
  } else {
    // Standard character or keyword search (uses GIN trigram indexes on name & number)
    cardParams = [`%${query}%`];
    cardWhere = `c.name ILIKE $1 OR c.number ILIKE $1`;
  }

  const setParams = [`%${parsed.setName || query}%`];

  const [cards, sets] = await Promise.all([
    dbQuery<CardSuggestionRow>(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.number,
        c.rarity,
        c.image_url,
        c.local_image_url,
        cpc.headline_cents,
        cpc.graded_prices,
        json_build_object(
          'name', s.name,
          'slug', s.slug,
          'games', json_build_object('slug', g.slug)
        ) AS sets
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      JOIN games g ON g.id = s.game_id
      LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
      WHERE ${cardWhere}
      ORDER BY 
        (c.image_url IS NOT NULL) DESC,
        cpc.headline_cents DESC NULLS LAST,
        c.id
      LIMIT $${cardParams.length + 1}
    `, [...cardParams, limit * 2]),
    dbQuery<SetRow>(`
      SELECT name, slug, card_count
      FROM sets
      WHERE name ILIKE $1
      LIMIT 4
    `, setParams),
  ]);

  const nlpSuggestions = parsed.suggestions;

  // Transform and score suggestions so top matches rise to the top
  const scoredCards: SearchResult[] = cards.map((card) => {
    const set = Array.isArray(card.sets) ? card.sets[0] : card.sets;
    const game = set?.games;

    // Extract PSA 10 price if available
    let psa10Price: number | null = null;
    if (card.graded_prices && typeof card.graded_prices === 'object') {
      const g10 = card.graded_prices['10'] || card.graded_prices['psa10'];
      if (g10 && typeof g10.average === 'number' && g10.average > 0) {
        psa10Price = g10.average;
      }
    }

    const item: SearchResult = {
      id: card.id,
      name: card.name,
      setName: set?.name || '',
      setSlug: set?.slug || '',
      number: card.number,
      rarity: card.rarity,
      imageUrl: card.local_image_url || card.image_url,
      marketPrice: card.headline_cents != null && card.headline_cents > 0 ? card.headline_cents / 100 : null,
      psa10Price,
      slug: card.slug,
      game: game?.slug || 'pokemon',
      curationStatus: card.curation_status || null,
      score: 0,
    };

    item.score = scoreCardMatch(
      {
        name: card.name,
        number: card.number,
        setName: set?.name,
        rarity: card.rarity || undefined,
      },
      parsed
    );

    return item;
  });

  // Sort by match score descending, then market price descending
  scoredCards.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.marketPrice || 0) - (a.marketPrice || 0);
  });

  return {
    cards: scoredCards.slice(0, limit),
    sets: sets.map((set) => ({
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
  const data = await dbQuery<SearchAnalyticsRow>(`
    SELECT search_query
    FROM search_analytics
    WHERE result_clicked = true
      AND created_at >= $1
    ORDER BY created_at DESC
    LIMIT 100
  `, [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]);

  if (!data || data.length === 0) {
    return [];
  }

  // Count occurrences
  const counts = new Map<string, number>();
  for (const row of data) {
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
  await dbQuery(
    `
      INSERT INTO search_analytics (search_query, result_clicked)
      VALUES ($1, $2)
    `,
    [query, resultCount > 0],
  );
}

/**
 * Record when a user clicks a search result
 */
export async function trackSearchClick(
  searchQuery: string,
  cardId: string,
  userId?: string
): Promise<void> {
  await dbQuery(
    `
      INSERT INTO search_analytics (search_query, card_id, user_id, result_clicked)
      VALUES ($1, $2, $3, true)
    `,
    [searchQuery, cardId, userId ?? null],
  );
}
