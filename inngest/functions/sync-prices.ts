/**
 * Price Sync Job
 * Syncs prices from PokemonPriceTracker API
 */

import { revalidatePath } from 'next/cache';
import { inngest } from '../client';
import { createServerClient } from '@/lib/supabase/client';
import { pptClient } from '@/lib/ppt/client';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';

// Card pages sit at `revalidate = 86400`, so a price write has to purge the page
// or the new price is invisible for up to a day.
//
// Unlike the price scrapers (which run in their own container and go through
// app/api/revalidate/card), these functions execute inside this Next.js runtime —
// Dockerfile.inngest points `-u` at this app's /api/inngest — so revalidatePath
// works directly, with no HTTP hop and no shared secret.
const CARD_SELECT_FOR_PATH = 'sets!inner ( slug, games!inner ( slug ) )';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cardPagePath(card: any): string | null {
  const cardSlug = card?.slug;
  const setSlug = card?.sets?.slug;
  const gameSlug = card?.sets?.games?.slug;
  if (!cardSlug || !setSlug || !gameSlug) return null;
  return `/${gameSlug}/${setSlug}/${cardSlug}`;
}

/**
 * revalidatePath THROWS (E263 "static generation store missing") rather than
 * no-opping when the async store is unavailable, so every call must be wrapped:
 * a missed cache purge degrades to a stale page, but an uncaught throw would
 * fail the whole price sync.
 */
function purgeCardPath(path: string, label: string): boolean {
  try {
    revalidatePath(path);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${label} revalidatePath failed for ${path}: ${message}`);
    return false;
  }
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

async function upsertPriceCache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  payload: Record<string, unknown>
) {
  try {
    await supabase
      .from('price_cache')
      .upsert(payload, { onConflict: 'card_id' });
  } catch {
    // Backward-compatible fallback for databases without unique(card_id)
    await supabase
      .from('price_cache')
      .upsert(payload, { onConflict: 'card_id,variant_id' });
  }
}

// Sync prices for active cards
export const syncPrices = inngest.createFunction(
  {
    id: 'sync-prices',
    name: 'Sync Card Prices',
  },
  { cron: '0 */4 * * *' }, // Every 4 hours
  async ({ step }) => {
    const supabase = createServerClient();

    // Get cards that need price updates (sorted by priority/activity)
    const staleThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    const cards = await step.run('fetch-stale-cards', async () => {
      const { data } = await supabase
        .from('cards')
        // slug + set/game slugs so each updated card's page can be purged below
        .select(`id, slug, tcg_player_id, name, ${CARD_SELECT_FOR_PATH}`)
        .not('tcg_player_id', 'is', null)
        .or(`last_price_fetch.is.null,last_price_fetch.lt.${staleThreshold}`)
        .order('last_price_fetch', { ascending: true, nullsFirst: true })
        .limit(500); // Batch size to stay within API limits
      return data as Array<{ id: string; tcg_player_id: string | null; name: string }> | null;
    });

    if (!cards || cards.length === 0) {
      return { updated: 0, message: 'No cards need price updates' };
    }

    let updated = 0;
    const errors: string[] = [];
    const purgedPaths: string[] = [];
    let failedPurges = 0;

    // Process in batches of 10 to avoid rate limiting
    for (let i = 0; i < cards.length; i += 10) {
      const batch = cards.slice(i, i + 10);

      // Results come back through the step's return value rather than by mutating
      // outer state: `step.sleep` below re-invokes this function with earlier steps
      // memoized, so in-callback mutations would be lost on replay.
      const batchResult = await step.run(`sync-batch-${i}`, async () => {
        const batchPaths: string[] = [];
        const batchErrors: string[] = [];
        let batchUpdated = 0;
        // Surfaced in the return value so a purge path that fails for every card
        // (E263, or any future async-context regression) shows up in the Inngest
        // dashboard instead of scrolling past in container logs while the run
        // still reports success.
        let batchFailedPurges = 0;

        for (const card of batch) {
          try {
            if (!card.tcg_player_id) continue;

            // Fetch from API
            const pptCard = await pptClient.getCard(card.tcg_player_id, {
              includeEbay: true,
            });

            // Transform graded prices
            const gradedPrices = normalizeSalesByGrade(pptCard.ebay?.salesByGrade as Record<string, unknown> | undefined);

            // Update price cache
            const expiresAt = new Date(Date.now() + CACHE_TTL.prices * 1000).toISOString();

            await upsertPriceCache(supabase, {
              card_id: card.id,
              variant_id: null,
              raw_prices: {
                nearMint: pptCard.prices.conditions.nearMint,
                lightlyPlayed: pptCard.prices.conditions.lightlyPlayed,
                moderatelyPlayed: pptCard.prices.conditions.moderatelyPlayed,
                heavilyPlayed: pptCard.prices.conditions.heavilyPlayed,
              },
              graded_prices: gradedPrices,
              ebay_sales: pptCard.ebay?.salesByGrade || {},
              fetched_at: new Date().toISOString(),
              expires_at: expiresAt,
            });

            // Update card's last fetch time
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('cards') as any)
              .update({ last_price_fetch: new Date().toISOString() })
              .eq('id', card.id);

            // Purge here, not after the Redis write below: the authoritative DB
            // writes are already committed, so a Redis failure must not cost this
            // card its purge (and with it the fence) and hide the new price for 24h.
            const path = cardPagePath(card);
            if (path) {
              if (!purgeCardPath(path, '[sync-prices]')) batchFailedPurges++;
              batchPaths.push(path);
            }

            // Store in Redis cache too
            await redis.set(
              CACHE_KEYS.cardPrices(card.tcg_player_id),
              {
                raw: pptCard.prices.conditions,
                graded: gradedPrices,
              },
              { ex: CACHE_TTL.prices }
            );

            // Add to price history (Disabled ppt-api per user request)
            /*
            if (pptCard.prices.market) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase.from('price_history') as any).insert({
                card_id: card.id,
                grade: 'raw',
                price: pptCard.prices.market,
                source: 'ppt-api',
                confidence: 'high',
              });
            }
            */

            batchUpdated++;
          } catch (err) {
            batchErrors.push(`${card.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }

        return {
          paths: batchPaths,
          updated: batchUpdated,
          errors: batchErrors,
          failedPurges: batchFailedPurges,
        };
      });

      // Defensive reads: a run already in flight when this deploys will replay the
      // memoized result of the OLD callback, which returned undefined. Inngest
      // injects stored results without re-executing, so `batchResult.paths` would
      // throw on exactly the runs spanning the deploy.
      purgedPaths.push(...(batchResult?.paths ?? []));
      updated += batchResult?.updated ?? 0;
      errors.push(...(batchResult?.errors ?? []));
      failedPurges += batchResult?.failedPurges ?? 0;

      // Rate limiting between batches
      if (i + 10 < cards.length) {
        await step.sleep('rate-limit', '2s');
      }
    }

    // Race fence. A render that began before the write can finish after the purge
    // and then be cached as fresh for the full 24h TTL, because Next only expires
    // entries whose timestamp predates the invalidation. Re-purging after a delay
    // wider than any render closes that window; step.sleep is durable and free.
    if (purgedPaths.length > 0) {
      await step.sleep('settle-before-refence', '30s');
      await step.run('refence-purged-paths', async () => {
        for (const path of purgedPaths) {
          purgeCardPath(path, '[sync-prices][fence]');
        }
        return { refenced: purgedPaths.length };
      });
    }

    return {
      updated,
      failedPurges,
      errors: errors.slice(0, 10), // Limit error reporting
      message: `Synced ${updated} cards`,
    };
  }
);

// Sync a specific set's prices
export const syncSetPrices = inngest.createFunction(
  {
    id: 'sync-set-prices',
    name: 'Sync Set Prices',
  },
  { event: 'cards/sync-set' },
  async ({ event, step }) => {
    const { setId, pptSetId } = event.data;
    const supabase = createServerClient();

    // Fetch all cards in the set from API
    const cards = await step.run('fetch-set-cards', async () => {
      return pptClient.getCardsBySet(pptSetId, {
        includeEbay: true,
      });
    });

    // Update each card
    const setResult = await step.run('update-cards', async () => {
      const batchPaths: string[] = [];
      let batchUpdated = 0;
      let batchFailedPurges = 0;

      for (const pptCard of cards) {
        // Find card in our database
        const { data: cardData } = await supabase
          .from('cards')
          // slug + set/game slugs so the page can be purged after the write
          .select(`id, slug, ${CARD_SELECT_FOR_PATH}`)
          .eq('tcg_player_id', pptCard.tcgPlayerId)
          .single();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const card = cardData as any;

        if (!card) continue;

        const gradedPrices = normalizeSalesByGrade(pptCard.ebay?.salesByGrade as Record<string, unknown> | undefined);

        await upsertPriceCache(supabase, {
          card_id: card.id,
          variant_id: null,
          raw_prices: pptCard.prices.conditions,
          graded_prices: gradedPrices,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CACHE_TTL.prices * 1000).toISOString(),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('cards') as any)
          .update({ last_price_fetch: new Date().toISOString() })
          .eq('id', card.id);

        const path = cardPagePath(card);
        if (path) {
          if (!purgeCardPath(path, '[sync-set-prices]')) batchFailedPurges++;
          batchPaths.push(path);
        }

        batchUpdated++;
      }

      return { paths: batchPaths, updated: batchUpdated, failedPurges: batchFailedPurges };
    });

    // Defensive reads — see the note in syncPrices about replayed legacy results.
    const setPaths = setResult?.paths ?? [];

    // Race fence — see the note in syncPrices.
    if (setPaths.length > 0) {
      await step.sleep('settle-before-refence', '30s');
      await step.run('refence-purged-paths', async () => {
        for (const path of setPaths) {
          purgeCardPath(path, '[sync-set-prices][fence]');
        }
        return { refenced: setPaths.length };
      });
    }

    return {
      updated: setResult?.updated ?? 0,
      failedPurges: setResult?.failedPurges ?? 0,
      setId,
    };
  }
);
