/**
 * PokemonPriceTracker Service
 * Combines API client with caching and database operations
 */

import { pptClient, PPTCard, PPTSet } from './client';
import {
  redis,
  CACHE_KEYS,
  CACHE_TTL,
  withRequestCoalescing,
} from '@/lib/redis/client';
import { dbQuery } from '@/lib/db/client';
import type { Tables, TablesInsert } from '@/lib/supabase/database.types';
import { slugify } from '@/lib/utils';

// Types for transformed data
export interface CardWithPrices {
  card: Pick<
    Tables<'cards'>,
    | 'id'
    | 'set_id'
    | 'name'
    | 'slug'
    | 'number'
    | 'rarity'
    | 'artist'
    | 'description'
    | 'tcg_player_id'
    | 'ppt_card_id'
    | 'image_url'
    | 'local_image_url'
    | 'image_fetched_at'
    | 'lore'
    | 'print_run_info'
    | 'created_at'
    | 'updated_at'
  >;
  prices: {
    headline: {
      usd: number | null;
      kind: 'market';
    };
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
 * Fetch card and cache the request-scoped result in Redis.
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
      lore: null,
      print_run_info: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    prices: {
      headline: {
        usd: toNumberOrNull(pptCard.prices.market ?? pptCard.prices.conditions.nearMint),
        kind: 'market',
      },
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
  const errors: string[] = [];
  let cardsImported = 0;

  try {
    // Get all cards in the set
    const cards = await pptClient.getCardsBySet(pptSetId, {
      includeEbay: options?.includeEbay ?? true,
    });

    // Get or create the set in our database
    const existingSetRows = await dbQuery<{ id: string }>(
      'SELECT id FROM sets WHERE ppt_set_id = $1 LIMIT 1',
      [pptSetId],
    );
    const existingSet = existingSetRows[0] || null;

    if (!existingSet) {
      // Need to create the set first
      const sets = await pptClient.getSets();
      const pptSet = sets.find((s) => s.id === pptSetId);

      if (!pptSet) {
        throw new Error(`Set ${pptSetId} not found in PPT API`);
      }

      // Get the Pokemon game ID
      const gameRows = await dbQuery<{ id: string }>(
        "SELECT id FROM games WHERE slug = 'pokemon' LIMIT 1",
      );
      const game = gameRows[0] || null;

      if (!game) {
        throw new Error('Pokemon game not found in database');
      }

      await dbQuery(
        `
          INSERT INTO sets (
            game_id,
            name,
            slug,
            release_date,
            card_count,
            ppt_set_id,
            tcg_player_group_id,
            priority
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          game.id,
          pptSet.name,
          slugify(pptSet.name),
          pptSet.releaseDate,
          pptSet.cardCount,
          pptSetId,
          pptSet.tcgPlayerGroupId ?? null,
          options?.priority ?? 0,
        ],
      );
    }

    // Get the set ID
    const setRows = await dbQuery<{ id: string }>(
      'SELECT id FROM sets WHERE ppt_set_id = $1 LIMIT 1',
      [pptSetId],
    );
    const set = setRows[0] || null;

    if (!set) {
      throw new Error('Failed to get set ID');
    }

    // Import cards in batches
    const batchSize = 50;
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);

      const cardInserts: TablesInsert<'cards'>[] = batch.map((card) => ({
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

      try {
        const cardParams = cardInserts.flatMap((card) => [
          card.set_id,
          card.name,
          card.slug,
          card.number,
          card.rarity ?? null,
          card.artist ?? null,
          card.tcg_player_id ?? null,
          card.ppt_card_id ?? null,
          card.image_url ?? null,
          card.last_price_fetch ?? null,
        ]);
        const cardPlaceholders = cardInserts
          .map((_, rowIndex) => {
            const offset = rowIndex * 10;
            return `(${Array.from({ length: 10 }, (_, columnIndex) => `$${offset + columnIndex + 1}`).join(', ')})`;
          })
          .join(', ');

        await dbQuery(
          `
            INSERT INTO cards (
              set_id,
              name,
              slug,
              number,
              rarity,
              artist,
              tcg_player_id,
              ppt_card_id,
              image_url,
              last_price_fetch
            )
            VALUES ${cardPlaceholders}
            ON CONFLICT (set_id, slug) DO UPDATE SET
              name = EXCLUDED.name,
              number = EXCLUDED.number,
              rarity = EXCLUDED.rarity,
              artist = EXCLUDED.artist,
              tcg_player_id = EXCLUDED.tcg_player_id,
              ppt_card_id = EXCLUDED.ppt_card_id,
              image_url = EXCLUDED.image_url,
              last_price_fetch = EXCLUDED.last_price_fetch
          `,
          cardParams,
        );
        cardsImported += batch.length;
      } catch (error) {
        errors.push(`Batch ${i / batchSize}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    await dbQuery(
      `
        UPDATE sets
        SET is_imported = true,
            imported_at = $1
        WHERE id = $2
      `,
      [new Date().toISOString(), set.id],
    );

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
  const errors: string[] = [];
  let setsUpdated = 0;

  try {
    const sets = await pptClient.getSets({
      language: 'en',
      sortBy: 'releaseDate',
      sortDirection: 'desc',
    });

    // Get the Pokemon game ID
    const gameRows = await dbQuery<{ id: string }>(
      "SELECT id FROM games WHERE slug = 'pokemon' LIMIT 1",
    );
    const game2 = gameRows[0] || null;

    if (!game2) {
      throw new Error('Pokemon game not found');
    }

    // Upsert all sets
    const setInserts: TablesInsert<'sets'>[] = sets.map((set, index) => ({
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

    const setParams = setInserts.flatMap((set) => [
      set.game_id,
      set.name,
      set.slug,
      set.release_date,
      set.card_count,
      set.ppt_set_id,
      set.tcg_player_group_id ?? null,
      set.image_url ?? null,
      set.priority ?? 0,
    ]);
    const setPlaceholders = setInserts
      .map((_, rowIndex) => {
        const offset = rowIndex * 9;
        return `(${Array.from({ length: 9 }, (_, columnIndex) => `$${offset + columnIndex + 1}`).join(', ')})`;
      })
      .join(', ');

    await dbQuery(
      `
        INSERT INTO sets (
          game_id,
          name,
          slug,
          release_date,
          card_count,
          ppt_set_id,
          tcg_player_group_id,
          image_url,
          priority
        )
        VALUES ${setPlaceholders}
        ON CONFLICT (game_id, slug) DO UPDATE SET
          name = EXCLUDED.name,
          release_date = EXCLUDED.release_date,
          card_count = EXCLUDED.card_count,
          ppt_set_id = EXCLUDED.ppt_set_id,
          tcg_player_group_id = EXCLUDED.tcg_player_group_id,
          image_url = EXCLUDED.image_url,
          priority = EXCLUDED.priority
      `,
      setParams,
    );
    setsUpdated = sets.length;

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
  prices: {
    raw: Record<string, unknown>;
    graded: Record<string, unknown>;
  } | null;
  lastUpdated: string | null;
  hoursStale: number;
} | null> {
  const cardRows = await dbQuery<{ id: string }>(
    'SELECT id FROM cards WHERE tcg_player_id = $1 LIMIT 1',
    [tcgPlayerId],
  );
  const card = cardRows[0] || null;

  if (!card) {
    return null;
  }

  const currentPriceRows = await dbQuery<{
    source_prices: unknown;
    graded_prices: unknown;
    computed_at: string;
  }>(`
    SELECT source_prices, graded_prices, computed_at
    FROM card_price_current
    WHERE card_id = $1
    LIMIT 1
  `, [card.id]);
  const currentPrice = currentPriceRows[0] || null;

  if (!currentPrice) return null;

  const sourcePrices = currentPrice.source_prices as Record<string, unknown>;
  const gradedPrices = currentPrice.graded_prices as Record<string, unknown>;
  const fetchedAt = new Date(currentPrice.computed_at);
  const hoursStale = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);

  return {
    prices: {
      raw: sourcePrices,
      graded: gradedPrices,
    },
    lastUpdated: currentPrice.computed_at,
    hoursStale: Math.round(hoursStale * 10) / 10,
  };
}
