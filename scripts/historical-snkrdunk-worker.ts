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
  const maxPages = 10; // Up to 1000 sales records per card

  console.log(`  -> Fetching Snkrdunk sales for product ${productCode}...`);

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

      if (soldListings.length === 0 && page > 2) {
        break;
      }

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
      await new Promise(r => setTimeout(r, 600)); // Respect rate limit
    } catch (err: any) {
      console.error(`  ✗ Error fetching page ${page}:`, err.message);
      break;
    }
  }

  // Mark historical_fetched = true on card record
  await supabase
    .from('cards')
    .update({ historical_fetched: true, updated_at: new Date().toISOString() })
    .eq('id', cardId);

  return totalSaved;
}

async function run() {
  console.log('🤖 Starting Snkrdunk Historical Price & Trade Backfill Worker...');

  while (true) {
    try {
      // Prioritize Japanese One Piece cards with snkrdunk_url that haven't fetched history yet
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, slug, name, snkrdunk_url, historical_fetched')
        .not('snkrdunk_url', 'is', null)
        .or('historical_fetched.is.null,historical_fetched.eq.false')
        .like('slug', 'op-%-ja')
        .limit(50);

      if (error) {
        console.error('Error querying cards:', error);
        await new Promise(r => setTimeout(r, 60000));
        continue;
      }

      let processQueue = cards || [];

      if (processQueue.length === 0) {
        const { data: remainingCards } = await supabase
          .from('cards')
          .select('id, slug, name, snkrdunk_url, historical_fetched')
          .not('snkrdunk_url', 'is', null)
          .or('historical_fetched.is.null,historical_fetched.eq.false')
          .limit(50);

        processQueue = remainingCards || [];
      }

      if (processQueue.length === 0) {
        console.log('No cards pending Snkrdunk historical backfill. Sleeping 15m...');
        await new Promise(r => setTimeout(r, 15 * 60 * 1000));
        continue;
      }

      console.log(`Processing batch of ${processQueue.length} cards for Snkrdunk historical backfill...`);

      for (const card of processQueue) {
        const snkrdunkId = extractSnkrdunkId(card.snkrdunk_url);
        if (!snkrdunkId) {
          await supabase.from('cards').update({ historical_fetched: true }).eq('id', card.id);
          continue;
        }

        console.log(`Processing ${card.slug} (${card.name}) [Snkrdunk ID: ${snkrdunkId}]...`);
        const savedCount = await fetchHistoricalSalesForCard(card.id, snkrdunkId);
        console.log(`  ✓ Saved ${savedCount} historical Snkrdunk trades for ${card.slug}`);

        await new Promise(r => setTimeout(r, 1000));
      }

      console.log('Batch complete. Waiting 10s before next batch...');
      await new Promise(r => setTimeout(r, 10000));
    } catch (loopErr: any) {
      console.error('Unexpected error in worker loop:', loopErr);
      await new Promise(r => setTimeout(r, 30000));
    }
  }
}

run().catch(err => {
  console.error('Fatal Snkrdunk Historical worker error:', err);
  process.exit(1);
});
