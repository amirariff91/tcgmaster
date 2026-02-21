/**
 * Price Sync Job
 * Syncs prices from PokemonPriceTracker API
 */

import { inngest } from '../client';
import { createServerClient } from '@/lib/supabase/client';
import { pptClient } from '@/lib/ppt/client';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';

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
        .select('id, tcg_player_id, name')
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

    // Process in batches of 10 to avoid rate limiting
    for (let i = 0; i < cards.length; i += 10) {
      const batch = cards.slice(i, i + 10);

      await step.run(`sync-batch-${i}`, async () => {
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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('price_cache') as any)
              .upsert({
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
              }, {
                onConflict: 'card_id',
              });

            // Update card's last fetch time
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('cards') as any)
              .update({ last_price_fetch: new Date().toISOString() })
              .eq('id', card.id);

            // Store in Redis cache too
            await redis.set(
              CACHE_KEYS.cardPrices(card.tcg_player_id),
              {
                raw: pptCard.prices.conditions,
                graded: gradedPrices,
              },
              { ex: CACHE_TTL.prices }
            );

            // Add to price history
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

            updated++;
          } catch (err) {
            errors.push(`${card.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      });

      // Rate limiting between batches
      if (i + 10 < cards.length) {
        await step.sleep('rate-limit', '2s');
      }
    }

    return {
      updated,
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

    let updated = 0;

    // Update each card
    await step.run('update-cards', async () => {
      for (const pptCard of cards) {
        // Find card in our database
        const { data: cardData } = await supabase
          .from('cards')
          .select('id')
          .eq('tcg_player_id', pptCard.tcgPlayerId)
          .single();

        const card = cardData as { id: string } | null;

        if (!card) continue;

        const gradedPrices = normalizeSalesByGrade(pptCard.ebay?.salesByGrade as Record<string, unknown> | undefined);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('price_cache') as any)
          .upsert({
            card_id: card.id,
            variant_id: null,
            raw_prices: pptCard.prices.conditions,
            graded_prices: gradedPrices,
            fetched_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + CACHE_TTL.prices * 1000).toISOString(),
          }, {
            onConflict: 'card_id',
          });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('cards') as any)
          .update({ last_price_fetch: new Date().toISOString() })
          .eq('id', card.id);

        updated++;
      }
    });

    return { updated, setId };
  }
);
