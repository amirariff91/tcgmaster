import { redis } from '../redis/client';

export type PriceSource = 'pricecharting' | 'yuyutei' | 'snkrdunk' | 'cardrush';

const SAFE_MODE = process.env.SAFE_MODE === '1';
const DEFAULT_INTERVAL_MS = SAFE_MODE ? 40000 : 17000;
const REDIS_TIMEOUT_MS = 3000;

const SOURCE_ENV_KEYS: Record<PriceSource, string> = {
  pricecharting: 'SCRAPER_RATE_LIMIT_PRICECHARTING_MS',
  yuyutei: 'SCRAPER_RATE_LIMIT_YUYUTEI_MS',
  snkrdunk: 'SCRAPER_RATE_LIMIT_SNKRDUNK_MS',
  cardrush: 'SCRAPER_RATE_LIMIT_CARDRUSH_MS',
};

const SOURCE_INTERVALS_MS: Record<PriceSource, number> = {
  pricecharting: getConfiguredInterval('pricecharting'),
  yuyutei: getConfiguredInterval('yuyutei'),
  snkrdunk: getConfiguredInterval('snkrdunk'),
  cardrush: getConfiguredInterval('cardrush'),
};

// Reserves the next slot for a source and returns how long the caller must wait.
// Uses the Redis server clock so reservations stay consistent across processes with
// skewed clocks, and the whole read-modify-write is atomic inside the script.
//
// The stored value is the instant the CURRENT caller may fire. The next caller must
// then wait until that instant + interval. Note the reservation must always advance
// by `interval` from the previous one — anchoring it to `now` whenever the previous
// slot is already in the past means two calls a millisecond apart both fire
// immediately, which silently disables the limiter.
const distributedRateLimitScript = redis.createScript<number>(`
  local nowParts = redis.call('TIME')
  local now = tonumber(nowParts[1]) * 1000 + math.floor(tonumber(nowParts[2]) / 1000)
  local interval = tonumber(ARGV[1])
  local lastReservation = tonumber(redis.call('GET', KEYS[1]))
  local nextReservation = now

  if lastReservation then
    nextReservation = math.max(now, lastReservation + interval)
  end

  -- Keep the key alive for the whole wait, plus one interval of headroom.
  local ttl = (nextReservation - now) + (interval * 2)
  redis.call('SET', KEYS[1], tostring(nextReservation), 'PX', math.ceil(ttl))
  return nextReservation - now
`);

const localNextAvailableAt = new Map<PriceSource, number>();
let redisWarningLogged = false;

function getConfiguredInterval(source: PriceSource): number {
  const configuredValue = Number(process.env[SOURCE_ENV_KEYS[source]]);
  if (Number.isFinite(configuredValue) && configuredValue > 0) {
    return configuredValue;
  }
  return DEFAULT_INTERVAL_MS;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Redis rate limiter timed out')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function reserveLocally(source: PriceSource, intervalMs: number): number {
  const now = Date.now();
  const nextAvailableAt = Math.max(now, localNextAvailableAt.get(source) || 0);
  localNextAvailableAt.set(source, nextAvailableAt + intervalMs);
  return Math.max(0, nextAvailableAt - now);
}

function logRedisFallback(error: unknown): void {
  if (redisWarningLogged) return;
  redisWarningLogged = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[scraper-rate-limit] Redis unavailable; using local fallback: ${message}`);
}

export function getSourceRateLimitIntervalMs(source: PriceSource): number {
  return SOURCE_INTERVALS_MS[source];
}

export async function waitForSourceRateLimit(source: PriceSource): Promise<void> {
  const intervalMs = getSourceRateLimitIntervalMs(source);
  const redisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (!redisConfigured) {
    await sleep(reserveLocally(source, intervalMs));
    return;
  }

  try {
    const delayMs = await withTimeout(
      distributedRateLimitScript.eval([`scraper:rate-limit:${source}`], [String(intervalMs)]),
      REDIS_TIMEOUT_MS
    );

    if (!Number.isFinite(delayMs)) {
      throw new Error('Redis returned an invalid rate-limit delay');
    }

    // Keep a local reservation too, so a later Redis outage cannot cause this
    // process to immediately issue another request. The same source keys are
    // shared by PriceCharting, Yuyutei, SnkrDunk, and Cardrush workers.
    const reservationAt = Date.now() + Math.max(0, delayMs);
    localNextAvailableAt.set(
      source,
      Math.max(localNextAvailableAt.get(source) || 0, reservationAt + intervalMs)
    );
    await sleep(Math.max(0, delayMs));
  } catch (error) {
    logRedisFallback(error);
    await sleep(reserveLocally(source, intervalMs));
  }
}
