import { Redis } from '@upstash/redis';

// Initialize Upstash Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache key patterns
export const CACHE_KEYS = {
  card: (tcgPlayerId: string) => `card:${tcgPlayerId}`,
  cardPrices: (tcgPlayerId: string) => `prices:${tcgPlayerId}`,
  cardLock: (tcgPlayerId: string) => `lock:${tcgPlayerId}`,
  population: (cardId: string) => `pop:${cardId}`,
  cert: (certNumber: string, company: string) => `cert:${company}:${certNumber}`,
  search: (query: string) => `search:${query}`,
  trending: () => 'trending:cards',
  setCards: (setId: string) => `set:${setId}:cards`,
} as const;

// TTL values in seconds
export const CACHE_TTL = {
  // Card data - 1-4 hours based on activity
  card: {
    hot: 1 * 60 * 60,      // 1 hour for active cards
    warm: 2 * 60 * 60,     // 2 hours for moderate activity
    cold: 4 * 60 * 60,     // 4 hours for low activity
  },
  // Price data
  prices: 1 * 60 * 60,     // 1 hour
  // Population reports - 24 hours (doesn't change often)
  population: 24 * 60 * 60,
  // Cert lookup - 1 week (rarely changes)
  cert: 7 * 24 * 60 * 60,
  // Search results - 5 minutes
  search: 5 * 60,
  // Trending - 15 minutes
  trending: 15 * 60,
  // Request coalescing lock - 30 seconds
  lock: 30,
} as const;

// Request coalescing for preventing thundering herd
export async function withRequestCoalescing<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL.prices
): Promise<T> {
  const lockKey = `${key}:lock`;
  const waitersKey = `${key}:waiters`;

  // Try to get cached data first
  const cached = await redis.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Try to acquire lock
  const acquired = await redis.set(lockKey, '1', {
    nx: true,
    ex: CACHE_TTL.lock,
  });

  if (acquired) {
    // We got the lock, fetch the data
    try {
      const data = await fetchFn();
      // Cache the result
      await redis.set(key, data, { ex: ttl });
      // Notify waiters (if any) by just deleting the lock
      await redis.del(lockKey);
      return data;
    } catch (error) {
      // Release lock on error
      await redis.del(lockKey);
      throw error;
    }
  } else {
    // Someone else is fetching, wait for the data
    // Poll for result with exponential backoff
    let attempts = 0;
    const maxAttempts = 10;
    const baseDelay = 100; // ms

    while (attempts < maxAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelay * Math.pow(1.5, attempts))
      );

      const result = await redis.get<T>(key);
      if (result !== null) {
        return result;
      }

      // Check if lock is still held
      const lockExists = await redis.exists(lockKey);
      if (!lockExists) {
        // Lock released but no data - maybe there was an error
        // Try fetching ourselves
        break;
      }

      attempts++;
    }

    // Fallback: fetch directly if waiting timed out
    const data = await fetchFn();
    await redis.set(key, data, { ex: ttl });
    return data;
  }
}

// Cache-aside pattern helper
export async function cacheAside<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL.prices,
  options?: {
    staleWhileRevalidate?: boolean;
    staleTTL?: number;
  }
): Promise<{ data: T; fromCache: boolean; stale?: boolean }> {
  // Try cache first
  const cached = await redis.get<{ data: T; timestamp: number }>(key);

  if (cached !== null) {
    const age = Date.now() - cached.timestamp;
    const isStale = age > ttl * 1000;

    if (isStale && options?.staleWhileRevalidate) {
      // Return stale data immediately, refresh in background
      refreshCache(key, fetchFn, ttl).catch(console.error);
      return { data: cached.data, fromCache: true, stale: true };
    }

    if (!isStale) {
      return { data: cached.data, fromCache: true };
    }
  }

  // Cache miss or stale without SWR - fetch fresh data
  const data = await fetchFn();
  await redis.set(key, { data, timestamp: Date.now() }, { ex: ttl * 2 }); // Store longer for SWR
  return { data, fromCache: false };
}

async function refreshCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number
): Promise<void> {
  const lockKey = `${key}:refresh`;
  const acquired = await redis.set(lockKey, '1', { nx: true, ex: 60 });

  if (!acquired) return; // Another process is refreshing

  try {
    const data = await fetchFn();
    await redis.set(key, { data, timestamp: Date.now() }, { ex: ttl * 2 });
  } finally {
    await redis.del(lockKey);
  }
}

// Bulk cache operations
export async function cacheManyCards<T>(
  cards: Array<{ id: string; data: T }>,
  ttl: number = CACHE_TTL.card.warm
): Promise<void> {
  const pipeline = redis.pipeline();

  for (const card of cards) {
    pipeline.set(CACHE_KEYS.card(card.id), card.data, { ex: ttl });
  }

  await pipeline.exec();
}

export async function getCachedCards<T>(ids: string[]): Promise<Map<string, T>> {
  if (ids.length === 0) return new Map();

  const keys = ids.map((id) => CACHE_KEYS.card(id));
  const results = await redis.mget<T[]>(...keys);

  const map = new Map<string, T>();
  results.forEach((result, index) => {
    if (result !== null) {
      map.set(ids[index], result);
    }
  });

  return map;
}

// Invalidation helpers
export async function invalidateCard(tcgPlayerId: string): Promise<void> {
  await redis.del(
    CACHE_KEYS.card(tcgPlayerId),
    CACHE_KEYS.cardPrices(tcgPlayerId)
  );
}

export async function invalidateSet(setId: string): Promise<void> {
  // Get all card keys for this set and delete them
  const cardKeys = await redis.keys(`card:*`);
  if (cardKeys.length > 0) {
    await redis.del(...cardKeys);
  }
  await redis.del(CACHE_KEYS.setCards(setId));
}
