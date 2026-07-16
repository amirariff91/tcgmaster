import { createClient } from '@supabase/supabase-js';
import { fetchJapanesePrice } from '../../lib/price-engine/yuyutei';
import { fetchSnkrdunkPrice } from '../../lib/price-engine/snkrdunk';
import { fetchPriceChartingPrice } from '../../lib/price-engine/pricecharting';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// SAFE_MODE=1 → slower sleep to reduce ban risk; set in .env or environment
const SAFE_MODE = process.env.SAFE_MODE === '1';
const SLEEP_MS = SAFE_MODE ? 40000 : 17000; // 40s in safe mode, 17s normal

async function run() {
  console.log(`Starting Continuous Scrape Engine (Japanese One Piece) [SAFE_MODE=${SAFE_MODE}]...`);
  
  while (true) {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, name, slug, number, yuyutei_url, snkrdunk_url')
      .ilike('slug', 'op-%')
      .ilike('slug', '%-ja')
      .order('last_price_fetch', { ascending: true, nullsFirst: true })
      .limit(1);
      
    if (error || !cards || cards.length === 0) {
      console.error("Failed to fetch queue", error);
      await new Promise(r => setTimeout(r, SLEEP_MS));
      continue;
    }
    
    const card = cards[0];
    console.log(`[Japanese OP] Processing: ${card.name} (${card.number})`);
    
    const results: { price: number; source: string; grade: string }[] = [];
    const updatePayload: any = {};
    
    // 1. Yuyutei (fast, no Puppeteer)
    console.log('[Japanese OP] Fetching from Yuyutei...');
    const yuyuteiResult = await fetchJapanesePrice(card.yuyutei_url || card.number);
    if (yuyuteiResult !== null) {
      results.push({ price: yuyuteiResult.price, source: 'yuyutei', grade: 'raw' });
      console.log(`[Japanese OP] Yuyutei: ¥${Math.round(yuyuteiResult.price * 150)} (~$${yuyuteiResult.price})`);
      if (yuyuteiResult.url && yuyuteiResult.url !== card.yuyutei_url) {
        updatePayload.yuyutei_url = yuyuteiResult.url;
      }
    }

    // 2. SnkrDunk (Puppeteer-based)
    console.log('[Japanese OP] Fetching from SnkrDunk...');
    const snkrdunkResult = await fetchSnkrdunkPrice(card.snkrdunk_url || card.number);
    if (snkrdunkResult !== null) {
      results.push({ price: snkrdunkResult.price, source: 'snkrdunk', grade: 'raw' });
      console.log(`[Japanese OP] SnkrDunk: $${snkrdunkResult.price}`);
      if (snkrdunkResult.gradedPrice) {
        results.push({ price: snkrdunkResult.gradedPrice, source: 'snkrdunk', grade: 'psa10' });
        console.log(`[Japanese OP] SnkrDunk PSA 10: $${snkrdunkResult.gradedPrice}`);
      }
      if (snkrdunkResult.url && snkrdunkResult.url !== card.snkrdunk_url) {
        updatePayload.snkrdunk_url = snkrdunkResult.url;
      }
    }

    // 3. PriceCharting (Puppeteer-based)
    console.log('[Japanese OP] Fetching from PriceCharting...');
    const pcResult = await fetchPriceChartingPrice(`${card.number} japanese`);
    if (pcResult !== null) {
      results.push({ price: pcResult.price, source: 'pricecharting', grade: 'raw' });
      console.log(`[Japanese OP] PriceCharting: $${pcResult.price}`);
      if (pcResult.gradedPrice) {
        results.push({ price: pcResult.gradedPrice, source: 'pricecharting', grade: 'psa10' });
        console.log(`[Japanese OP] PriceCharting PSA 10: $${pcResult.gradedPrice}`);
      }
    }
    
    if (results.length > 0) {
      console.log(`[Japanese OP] Successfully fetched ${results.length} price points.`);
      
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
          console.error(`[Japanese OP] Failed to insert ${result.source} ${result.grade} price for ${card.number}:`, insertError);
        }
      }
    } else {
      console.log(`[Japanese OP] No prices found from any source, skipping...`);
      await supabase
        .from('cards')
        .update({ last_price_fetch: new Date().toISOString() })
        .eq('id', card.id);
    }
    
    console.log(`[Japanese OP] Sleeping for ${SLEEP_MS / 1000}s... Zzz...\n`);
    await new Promise(r => setTimeout(r, SLEEP_MS));
  }
}

run();

