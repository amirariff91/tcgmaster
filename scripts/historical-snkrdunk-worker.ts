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
        
        let parsedGrade = 'raw';
        let gradingCompany = null;
        const condition = l.condition || 'A';

        // Filter out unwanted Raw conditions
        if (['B', 'C', 'D'].includes(condition)) {
          return null;
        }
        
        // Regex to parse things like "PSA 10", "BGS 9.5", "CGC Pristine 10", "ARS 10+"
        // It captures the company name and the numeric grade.
        const gradeMatch = condition.match(/^(PSA|BGS|CGC|TAG|AGS|ARS)(?:\s+Pristine|\s+Perfect|\s+Black Label|\s+Gold Label)?\s+([0-9]+\.?[0-9]*\+?)$/i);
        
        if (gradeMatch) {
           gradingCompany = gradeMatch[1].toLowerCase();
           parsedGrade = gradeMatch[2].replace('+', ''); 
        } else if (condition.includes('PSA')) {
           // Fallback for weirdly formatted PSA
           const m = condition.match(/PSA\s*([0-9]+\.?[0-9]*)/i);
           if (m) { gradingCompany = 'psa'; parsedGrade = m[1]; }
        }

        const COMPANY_UUIDS: Record<string, string> = {
          psa: '74c51627-cc4b-4a82-a1c0-52b3975b47b7',
          bgs: 'cda2045f-5d78-49e7-b1c8-de04dac9888d',
          cgc: 'dce6169f-8958-4229-861b-686a4644c984',
          sgc: '7a7b5849-788b-40f6-9f42-14f2f27f68b3'
        };
        const finalCompanyId = gradingCompany ? COMPANY_UUIDS[gradingCompany] || null : null;

        return {
          card_id: cardId,
          source: 'snkrdunk',
          grade: parsedGrade,
          grading_company_id: finalCompanyId,
          price: l.priceAmount,
          raw_price: l.priceAmount,
          currency: l.currency || 'USD',
          condition: condition,
          recorded_at: recordedAt,
        };
      }).filter(Boolean);

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

  // Refresh latest prices from newly inserted history (strictly raw)
  const { data: latestPrices } = await supabase
    .from('price_history')
    .select('price, grade')
    .eq('card_id', cardId)
    .eq('grade', 'raw')
    .order('recorded_at', { ascending: false })
    .limit(20);

  if (latestPrices && latestPrices.length > 0) {
    const rawVal = latestPrices[0].price;
    await supabase.from('cards').update({
      historical_fetched: true,
      last_price_fetch: new Date().toISOString(),
      curation_status: 'pending',
    }).eq('id', cardId);
  } else {
    await supabase.from('cards').update({
      historical_fetched: true,
      last_price_fetch: new Date().toISOString(),
      curation_status: 'pending',
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

      const processQueue = cards || [];

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
