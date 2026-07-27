import { createClient } from '@supabase/supabase-js';
import { fetchCardrushPrice } from '../../lib/price-engine/cardrush';
import { fetchPriceChartingPrice } from '../../lib/price-engine/pricecharting';
import { revalidateCardPage } from '../../lib/price-engine/revalidate';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// SAFE_MODE=1 → slower sleep to reduce ban risk; set in .env or environment
const SAFE_MODE = process.env.SAFE_MODE === '1';
const SLEEP_MS = SAFE_MODE ? 40000 : 17000; // 40s in safe mode, 17s normal

const LABEL = '[DBFW]';

async function run() {
  console.log(`Starting Continuous Scrape Engine (Dragon Ball FW) [SAFE_MODE=${SAFE_MODE}]...`);

  // Race fence: a page render that began before our write can finish after the
  // purge and be cached as fresh for the full TTL, because Next only expires
  // entries whose timestamp predates the invalidation. Re-purging the previous
  // card one iteration later fences that window with SLEEP_MS of slack.
  //
  // Not free, but close: the two purge POSTs sit outside the sleep, so a hung web
  // app adds up to 2x the 3s timeout per iteration. Bounded cadence drift, never a
  // stall. Not durable either — a PM2 restart between the write and the next
  // iteration drops the fence, leaving the 24h TTL as the backstop.
  let previousCardId: string | null = null;

  while (true) {
    if (previousCardId) {
      await revalidateCardPage(previousCardId, `${LABEL} [fence]`);
      previousCardId = null;
    }

    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, name, slug, number, cardrush_url')
      .ilike('slug', 'dbfw-%')
      .order('last_price_fetch', { ascending: true, nullsFirst: true })
      .limit(1);
      
    if (error || !cards || cards.length === 0) {
      console.error("Failed to fetch queue", error);
      await new Promise(r => setTimeout(r, 17000));
      continue;
    }
    
    const card = cards[0];
    console.log(`[DBFW] Processing: ${card.name} (${card.number})`);
    
    const results: { price: number; source: string; grade: string }[] = [];
    const updatePayload: any = {};
    
    // 1. Cardrush
    console.log('[DBFW] Fetching from Cardrush...');
    const cardrushResult = await fetchCardrushPrice(card.cardrush_url || card.number);
    if (cardrushResult !== null) {
      results.push({ price: cardrushResult.price, source: 'cardrush', grade: 'raw' });
      console.log(`[DBFW] Cardrush: $${cardrushResult.price}`);
      if (cardrushResult.url && cardrushResult.url !== card.cardrush_url) {
        updatePayload.cardrush_url = cardrushResult.url;
      }
    }

    // 2. PriceCharting (Puppeteer-based)
    console.log('[DBFW] Fetching from PriceCharting...');
    const pcResult = await fetchPriceChartingPrice(`${card.number} japanese`);
    if (pcResult !== null) {
      results.push({ price: pcResult.price, source: 'pricecharting', grade: 'raw' });
      console.log(`[DBFW] PriceCharting: $${pcResult.price}`);
      if (pcResult.gradedPrice) {
        results.push({ price: pcResult.gradedPrice, source: 'pricecharting', grade: 'psa10' });
        console.log(`[DBFW] PriceCharting PSA 10: $${pcResult.gradedPrice}`);
      }
    }
    
    if (results.length > 0) {
      console.log(`[DBFW] Successfully fetched ${results.length} price points.`);
      
      const rawPrices = results.filter(r => r.grade === 'raw').map(r => r.price);
      if (rawPrices.length > 0) {
        const lowestPrice = Math.min(...rawPrices);
        const ttlPrice = Math.round(lowestPrice * 100);
        updatePayload.price_cache_ttl = ttlPrice;
      }
      
      updatePayload.last_price_fetch = new Date().toISOString();
      
      await supabase
        .from('cards')
        .update(updatePayload)
        .eq('id', card.id);

      // Also update price_cache table for fast reads
      const cacheRawPrices: Record<string, number> = {};
      const cacheGradedPrices: Record<string, Record<string, number>> = {};
      
      for (const res of results) {
        if (res.grade === 'raw') {
          cacheRawPrices[res.source] = res.price;
        } else {
          if (!cacheGradedPrices[res.grade]) cacheGradedPrices[res.grade] = {};
          cacheGradedPrices[res.grade][res.source] = res.price;
        }
      }
      
      const rawVals = Object.values(cacheRawPrices);
      if (rawVals.length > 0) {
        cacheRawPrices.market = Math.min(...rawVals);
      }
      
      const { error: cacheError } = await supabase.from('price_cache').upsert({
        card_id: card.id,
        variant_id: null,
        raw_prices: cacheRawPrices,
        graded_prices: cacheGradedPrices,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'card_id' });

      if (cacheError) {
        console.error(`${LABEL} Failed to upsert price_cache for ${card.number}:`, cacheError);
      }

      for (const result of results) {
        const { error: insertError } = await supabase
          .from('price_history')
          .insert({
            card_id: card.id,
            price: result.price,
            source: result.source,
            grade: result.grade
          });
        if (insertError) {
          console.error(`[DBFW] Failed to insert ${result.source} ${result.grade} price for ${card.number}:`, insertError);
        }
      }

      // Purge unconditionally: the `cards` update and the price_history inserts
      // above are independent of the price_cache upsert, and the page's featured
      // price comes from price_history — so even with cacheError set there is new
      // data on screen. A wasted purge is cheap; a skipped one hides a price for
      // 24h.
      await revalidateCardPage(card.id, LABEL);
      previousCardId = card.id;
    } else {
      console.log(`[DBFW] Failed to find any prices, skipping...`);
      await supabase
        .from('cards')
        .update({ last_price_fetch: new Date().toISOString() })
        .eq('id', card.id);
    }
    
    console.log(`[Dragon Ball FW] Sleeping for ${SLEEP_MS / 1000}s... Zzz...\n`);
    await new Promise(r => setTimeout(r, SLEEP_MS));
  }
}

run();
