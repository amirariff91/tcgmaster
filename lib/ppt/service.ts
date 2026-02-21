/**
 * PokemonPriceTracker Service
 * Combines API client with caching and database operations
 */

import { pptClient, PPTCard, PPTSet, PPTError } from './client';
import {
  redis,
  CACHE_KEYS,
  CACHE_TTL,
  withRequestCoalescing,
  cacheAside,
} from '@/lib/redis/client';
import { createServerClient } from '@/lib/supabase/client';
import type { Tables, InsertTables } from '@/lib/supabase/database.types';
import { slugify } from '@/lib/utils';

// Types for transformed data
export interface CardWithPrices {
  card: Tables<'cards'>;
  prices: {
    raw: {
      nearMint: number | null;
      lightlyPlayed: number | null;
      moderatelyPlayed: number | null;
      heavilyPlayed: number | null;
    };
    graded: Record<string, {
      average: number | null;
      median: number | null;
      low: number | null;
      high: number | null;
      count: number;
    }>;
  };
  lastUpdated: string;
  fromCache: boolean;
}

type RawGradeData = {
  average?: number | null;
  median?: number | null;
  low?: number | null;
  high?: number | null;
  averagePrice?: number | null;
  medianPrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  count?: number;
  smartMarketPrice?: {
    price?: number;
  };
};

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeGradeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_.-]/g, '');
}

function normalizeSalesByGrade(salesByGrade?: Record<string, unknown>) {
  const gradedPrices: Record<string, {
    average: number | null;
    median: number | null;
    low: number | null;
    high: number | null;
    count: number;
  }> = {};

  if (!salesByGrade) return gradedPrices;

  for (const [key, raw] of Object.entries(salesByGrade)) {
    if (!raw || typeof raw !== 'object') continue;

    const data = raw as RawGradeData;
    gradedPrices[normalizeGradeKey(key)] = {
      average: toNumberOrNull(data.average ?? data.averagePrice ?? data.smartMarketPrice?.price),
      median: toNumberOrNull(data.median ?? data.medianPrice),
      low: toNumberOrNull(data.low ?? data.minPrice),
      high: toNumberOrNull(data.high ?? data.maxPrice),
      count: typeof data.count === 'number' ? data.count : 0,
    };
  }

  return gradedPrices;
}

/**
 * Get card with prices, using cache-aside pattern with request coalescing
 */
export async function getCardWithPrices(
  tcgPlayerId: string,
  options?: {
    includeHistory?: boolean;
    includeEbay?: boolean;
    forceRefresh?: boolean;
  }
): Promise<CardWithPrices | null> {
  const cacheKey = CACHE_KEYS.cardPrices(tcgPlayerId);

  // Force refresh - bypass cache
  if (options?.forceRefresh) {
    return fetchAndCacheCard(tcgPlayerId, options);
  }

  // Use request coalescing to prevent thundering herd
  try {
    const result = await withRequestCoalescing(
      cacheKey,
      () => fetchCardFromAPI(tcgPlayerId, options),
      CACHE_TTL.prices
    );

    return {
      ...result,
      fromCache: true,
    };
  } catch (error) {
    // On error, try to return stale cached data
    const staleData = await redis.get<CardWithPrices>(cacheKey);
    if (staleData) {
      console.warn(`Returning stale data for card ${tcgPlayerId}`);
      return { ...staleData, fromCache: true };
    }
    throw error;
  }
}

/**
 * Fetch card from API and transform to our format
 */
async function fetchCardFromAPI(
  tcgPlayerId: string,
  options?: {
    includeHistory?: boolean;
    includeEbay?: boolean;
  }
): Promise<CardWithPrices> {
  const pptCard = await pptClient.getCard(tcgPlayerId, {
    includeHistory: options?.includeHistory ?? false,
    includeEbay: options?.includeEbay ?? true,
    days: 30,
  });

  return transformPPTCard(pptCard);
}

/**
 * Fetch card and update database cache
 */
async function fetchAndCacheCard(
  tcgPlayerId: string,
  options?: {
    includeHistory?: boolean;
    includeEbay?: boolean;
  }
): Promise<CardWithPrices> {
  const result = await fetchCardFromAPI(tcgPlayerId, options);

  // Cache in Redis
  await redis.set(
    CACHE_KEYS.cardPrices(tcgPlayerId),
    result,
    { ex: CACHE_TTL.prices }
  );

  // Update database cache
  const supabase = createServerClient();
  const ttlHours = determineCacheTTL(result);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('price_cache') as any)
    .upsert({
      card_id: result.card.id,
      variant_id: null,
      raw_prices: result.prices.raw,
      graded_prices: result.prices.graded,
      expires_at: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
      fetched_at: new Date().toISOString(),
    }, {
      onConflict: 'card_id',
    });

  return { ...result, fromCache: false };
}

/**
 * Transform PPT API response to our internal format
 */
function transformPPTCard(pptCard: PPTCard): CardWithPrices {
  // Transform graded prices
  const gradedPrices = normalizeSalesByGrade(pptCard.ebay?.salesByGrade as Record<string, unknown> | undefined);

  return {
    card: {
      id: '', // Will be set from DB lookup
      set_id: pptCard.setId,
      name: pptCard.name,
      slug: slugify(pptCard.name),
      number: pptCard.cardNumber,
      rarity: pptCard.rarity,
      artist: pptCard.artist || null,
      description: null,
      tcg_player_id: pptCard.tcgPlayerId,
      ppt_card_id: pptCard.id,
      image_url: pptCard.imageCdnUrl.large,
      local_image_url: null,
      image_fetched_at: null,
      last_price_fetch: new Date().toISOString(),
      price_cache_ttl: 3600,
      lore: null,
      print_run_info: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    prices: {
      raw: {
        nearMint: pptCard.prices.conditions.nearMint,
        lightlyPlayed: pptCard.prices.conditions.lightlyPlayed,
        moderatelyPlayed: pptCard.prices.conditions.moderatelyPlayed,
        heavilyPlayed: pptCard.prices.conditions.heavilyPlayed,
      },
      graded: gradedPrices,
    },
    lastUpdated: pptCard.lastUpdated,
    fromCache: false,
  };
}

/**
 * Determine cache TTL based on card activity
 */
function determineCacheTTL(card: CardWithPrices): number {
  // High-value or active cards get shorter TTL
  const nmPrice = card.prices.raw.nearMint || 0;

  if (nmPrice > 1000) {
    return 1; // 1 hour for high-value cards
  } else if (nmPrice > 100) {
    return 2; // 2 hours for mid-value cards
  } else {
    return 4; // 4 hours for low-value cards
  }
}

/**
 * Import a set from PPT API into the database
 */
export async function importSet(
  pptSetId: string,
  options?: {
    includeEbay?: boolean;
    priority?: number;
  }
): Promise<{
  cardsImported: number;
  errors: string[];
}> {
  const supabase = createServerClient();
  const errors: string[] = [];
  let cardsImported = 0;

  try {
    // Get all cards in the set
    const cards = await pptClient.getCardsBySet(pptSetId, {
      includeEbay: options?.includeEbay ?? true,
    });

    // Get or create the set in our database
    const { data: existingSet } = await supabase
      .from('sets')
      .select('id')
      .eq('ppt_set_id', pptSetId)
      .single();

    if (!existingSet) {
      // Need to create the set first
      const sets = await pptClient.getSets();
      const pptSet = sets.find((s) => s.id === pptSetId);

      if (!pptSet) {
        throw new Error(`Set ${pptSetId} not found in PPT API`);
      }

      // Get the Pokemon game ID
      const { data: gameData } = await supabase
        .from('games')
        .select('id')
        .eq('slug', 'pokemon')
        .single();

      const game = gameData as { id: string } | null;

      if (!game) {
        throw new Error('Pokemon game not found in database');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('sets') as any).insert({
        game_id: game.id,
        name: pptSet.name,
        slug: slugify(pptSet.name),
        release_date: pptSet.releaseDate,
        card_count: pptSet.cardCount,
        ppt_set_id: pptSetId,
        tcg_player_group_id: pptSet.tcgPlayerGroupId,
        priority: options?.priority ?? 0,
      });
    }

    // Get the set ID
    const { data: setData } = await supabase
      .from('sets')
      .select('id')
      .eq('ppt_set_id', pptSetId)
      .single();

    const set = setData as { id: string } | null;

    if (!set) {
      throw new Error('Failed to get set ID');
    }

    // Import cards in batches
    const batchSize = 50;
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);

      const cardInserts: InsertTables<'cards'>[] = batch.map((card) => ({
        set_id: set.id,
        name: card.name,
        slug: slugify(`${card.name}-${card.cardNumber}`),
        number: card.cardNumber,
        rarity: card.rarity,
        artist: card.artist,
        tcg_player_id: card.tcgPlayerId,
        ppt_card_id: card.id,
        image_url: card.imageCdnUrl.large,
        last_price_fetch: new Date().toISOString(),
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('cards') as any)
        .upsert(cardInserts, {
          onConflict: 'set_id,slug',
          ignoreDuplicates: false,
        });

      if (error) {
        errors.push(`Batch ${i / batchSize}: ${error.message}`);
      } else {
        cardsImported += batch.length;
      }

      // Also cache prices
      for (const card of batch) {
        const transformed = transformPPTCard(card);
        await redis.set(
          CACHE_KEYS.cardPrices(card.tcgPlayerId),
          transformed,
          { ex: CACHE_TTL.prices }
        );
      }
    }

    // Mark set as imported
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('sets') as any)
      .update({
        is_imported: true,
        imported_at: new Date().toISOString(),
      })
      .eq('id', set.id);

  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { cardsImported, errors };
}

/**
 * Sync all sets from PPT API
 */
export async function syncSets(): Promise<{
  setsUpdated: number;
  errors: string[];
}> {
  const supabase = createServerClient();
  const errors: string[] = [];
  let setsUpdated = 0;

  try {
    const sets = await pptClient.getSets({
      language: 'en',
      sortBy: 'releaseDate',
      sortDirection: 'desc',
    });

    // Get the Pokemon game ID
    const { data: gameData2 } = await supabase
      .from('games')
      .select('id')
      .eq('slug', 'pokemon')
      .single();

    const game2 = gameData2 as { id: string } | null;

    if (!game2) {
      throw new Error('Pokemon game not found');
    }

    // Upsert all sets
    const setInserts: InsertTables<'sets'>[] = sets.map((set, index) => ({
      game_id: game2.id,
      name: set.name,
      slug: slugify(set.name),
      release_date: set.releaseDate,
      card_count: set.cardCount,
      ppt_set_id: set.id,
      tcg_player_group_id: set.tcgPlayerGroupId,
      image_url: set.imageUrl,
      // Priority based on set age and value (customize as needed)
      priority: calculateSetPriority(set, index),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('sets') as any)
      .upsert(setInserts, {
        onConflict: 'game_id,slug',
      });

    if (error) {
      errors.push(error.message);
    } else {
      setsUpdated = sets.length;
    }

  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { setsUpdated, errors };
}

/**
 * Calculate priority for a set (higher = import first)
 */
function calculateSetPriority(set: PPTSet, index: number): number {
  // High-value vintage sets
  const highPrioritySets = [
    'base set',
    'jungle',
    'fossil',
    'team rocket',
    'gym heroes',
    'gym challenge',
    'neo genesis',
    'neo discovery',
    'neo revelation',
    'neo destiny',
  ];

  // Modern chase sets
  const modernChaseSets = [
    'crown zenith',
    '151',
    'evolving skies',
    'celebrations',
    'shining fates',
    'hidden fates',
  ];

  const nameLower = set.name.toLowerCase();

  if (highPrioritySets.some((s) => nameLower.includes(s))) {
    return 1000 - index;
  }

  if (modernChaseSets.some((s) => nameLower.includes(s))) {
    return 500 - index;
  }

  // Default priority based on release date (newer = higher)
  return 100 - index;
}

/**
 * Get stale price data with timestamp
 */
export async function getStaleCardPrices(
  tcgPlayerId: string
): Promise<{
  prices: CardWithPrices['prices'] | null;
  lastUpdated: string | null;
  hoursStale: number;
} | null> {
  const supabase = createServerClient();

  const { data: cardData } = await supabase
    .from('cards')
    .select(`
      id,
      last_price_fetch,
      price_cache!inner (
        raw_prices,
        graded_prices,
        fetched_at
      )
    `)
    .eq('tcg_player_id', tcgPlayerId)
    .single();

  interface StaleCardData {
    id: string;
    last_price_fetch: string | null;
    price_cache: {
      raw_prices: Record<string, number | null>;
      graded_prices: Record<string, unknown>;
      fetched_at: string;
    } | Array<{
      raw_prices: Record<string, number | null>;
      graded_prices: Record<string, unknown>;
      fetched_at: string;
    }>;
  }

  const card = cardData as StaleCardData | null;

  if (!card || !card.price_cache) {
    return null;
  }

  const cache = Array.isArray(card.price_cache)
    ? card.price_cache[0]
    : card.price_cache;

  const fetchedAt = new Date(cache.fetched_at);
  const hoursStale = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);

  return {
    prices: {
      raw: cache.raw_prices as CardWithPrices['prices']['raw'],
      graded: cache.graded_prices as CardWithPrices['prices']['graded'],
    },
    lastUpdated: cache.fetched_at,
    hoursStale: Math.round(hoursStale * 10) / 10,
  };
}
