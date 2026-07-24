import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

const Crockford32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Decode Crockford Base32 ULID string to Date object
 */
function decodeUlidTime(ulid: string): Date {
  if (!ulid || ulid.length < 10) return new Date();
  const timePart = ulid.substring(0, 10).toUpperCase();
  let time = 0;
  for (let i = 0; i < timePart.length; i++) {
    const index = Crockford32.indexOf(timePart[i]);
    if (index !== -1) {
      time = time * 32 + index;
    }
  }
  return new Date(time);
}

/**
 * Extract numeric Snkrdunk product ID from snkrdunk_url or card attributes
 */
function extractSnkrdunkId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:trading-cards|products|streetwears)\/(\d+)/i) || url.match(/\/(\d+)(?:\?|$)/);
  return match ? match[1] : null;
}

async function fetchHistoricalSalesForCard(cardId: string, snkrdunkId: string) {
  const productCode = `SW---${snkrdunkId}`;
  let totalSaved = 0;
  let page = 1;
  const maxPages = 200; // Uncapped deep historical search (up to 20,000 sales per card)

  console.log(`  -> Uncapped Deep Snkrdunk Sales Ingestion for product ${productCode}...`);

  while (page <= maxPages) {
    try {
      const url = `https://snkrdunk.com/en/v1/products/${productCode}/used-listings?perPage=100&page=${page}&sortType=latest&isOnlyOnSale=false`;
      const res = await fetch(url, { headers: HEADERS });

      if (!res.ok) {
        console.warn(`  ! HTTP ${res.status} fetching page ${page} for ${productCode}`);
        break;
      }

      const data = await res.json();
      const listings = data.usedListings || [];

      if (listings.length === 0) break;

      const soldListings = listings.filter((l: any) => l.isSold && l.priceAmount > 0);

      const insertRows = soldListings.map((l: any) => {
        const recordedAt = decodeUlidTime(l.listingUID).toISOString();
        return {
          card_id: cardId,
          source: 'snkrdunk',
          price: l.priceAmount,
          raw_price: l.priceAmount,
          currency: l.currency || 'USD',
          condition: l.condition || 'A',
          recorded_at: recordedAt,
        };
      });

      if (insertRows.length > 0) {
        const { error } = await supabase
          .from('price_history')
          .upsert(insertRows, { onConflict: 'card_id,recorded_at,source', ignoreDuplicates: true });

        if (error) {
          for (const row of insertRows) {
            try {
              await supabase.from('price_history').insert(row);
            } catch {}
          }
        }
        totalSaved += insertRows.length;
      }

      page++;
      await new Promise(r => setTimeout(r, 400)); // Smooth rate limiting
    } catch (err: any) {
      console.error(`  ✗ Error fetching page ${page}:`, err.message);
      break;
    }
  }

  // Refresh latest prices from newly inserted history
  const { data: latestPrices } = await supabase
    .from('price_history')
    .select('price, grade')
    .eq('card_id', cardId)
    .order('recorded_at', { ascending: false })
    .limit(20);

  if (latestPrices && latestPrices.length > 0) {
    const rawVal = latestPrices[0].price;
    await supabase.from('price_cache').upsert({
      card_id: cardId,
      raw_prices: { market: rawVal, snkrdunk: rawVal },
      source: 'snkrdunk',
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }, { onConflict: 'card_id' });

    await supabase.from('cards').update({
      price_cache_ttl: Math.round(rawVal * 100),
      historical_fetched: true,
      last_price_fetch: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', cardId);
  } else {
    await supabase.from('cards').update({
      historical_fetched: true,
      last_price_fetch: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', cardId);
  }

  return totalSaved;
}

async function run() {
  console.log('🤖 Starting Continuous 24/7 Rolling Snkrdunk Historical Trade Ingestion Engine...');

  while (true) {
    try {
      // Continuous 24/7 Rolling Queue: Order by last_price_fetch ASC (Nulls First)
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, slug, name, snkrdunk_url, last_price_fetch')
        .not('snkrdunk_url', 'is', null)
        .like('slug', 'op-%-ja')
        .order('last_price_fetch', { ascending: true, nullsFirst: true })
        .limit(50);

      if (error) {
        console.error('Error querying cards queue:', error);
        await new Promise(r => setTimeout(r, 30000));
        continue;
      }

      let processQueue = cards || [];

      if (processQueue.length === 0) {
        console.log('Queue empty. Retrying in 15 seconds...');
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }

      console.log(`Processing continuous batch of ${processQueue.length} cards for Snkrdunk historical trade backfill...`);

      for (const card of processQueue) {
        const snkrdunkId = extractSnkrdunkId(card.snkrdunk_url);
        if (!snkrdunkId) {
          await supabase.from('cards').update({ last_price_fetch: new Date().toISOString() }).eq('id', card.id);
          continue;
        }

        console.log(`Ingesting ${card.slug} (${card.name}) [Snkrdunk ID: ${snkrdunkId}]...`);
        const savedCount = await fetchHistoricalSalesForCard(card.id, snkrdunkId);
        console.log(`  ✓ Saved ${savedCount} historical Snkrdunk trades for ${card.slug}`);

        await new Promise(r => setTimeout(r, 600));
      }

      console.log('Batch complete. Recirculating to next batch in 5s...');
      await new Promise(r => setTimeout(r, 5000));
    } catch (loopErr: any) {
      console.error('Unexpected error in worker loop:', loopErr);
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

run().catch(err => {
  console.error('Fatal Snkrdunk Historical worker error:', err);
  process.exit(1);
});
