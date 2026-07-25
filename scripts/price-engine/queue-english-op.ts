import { createClient } from '@supabase/supabase-js';
import { fetchEnglishPrice } from '../../lib/price-engine/tcgcsv';
import { fetchPriceChartingPrice } from '../../lib/price-engine/pricecharting';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// SAFE_MODE=1 → slower sleep to reduce ban risk; set in .env or environment
const SAFE_MODE = process.env.SAFE_MODE === '1';
const SLEEP_MS = SAFE_MODE ? 40000 : 17000; // 40s in safe mode, 17s normal

async function run() {
  console.log(`Starting Continuous Scrape Engine (English One Piece) [SAFE_MODE=${SAFE_MODE}]...`);
  
  while (true) {
    // English OP cards start with 'op-' and do NOT end with '-ja'
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, name, slug, number, tcg_player_id, print_run_info, sets ( name )')
      .ilike('slug', 'op-%')
      .not('slug', 'ilike', '%-ja')
      .order('last_price_fetch', { ascending: true, nullsFirst: true })
      .limit(1);
      
    if (error || !cards || cards.length === 0) {
      console.error("Failed to fetch queue", error);
      await new Promise(r => setTimeout(r, 17000));
      continue;
    }
    
    const card = cards[0];
    console.log(`[English OP] Processing: ${card.name} (${card.number})`);
    
    const results: { price: number; source: string; grade: string }[] = [];
    
    // 1. TCGPlayer (Fast)
    console.log('[English OP] Fetching from TCGPlayer...');
    const tcgPlayerResult = await fetchEnglishPrice(card.number, (card as any).sets?.name, card.tcg_player_id);
    if (tcgPlayerResult !== null) {
      results.push({ price: tcgPlayerResult.price, source: 'tcgplayer', grade: 'raw' });
      console.log(`[English OP] TCGPlayer: $${tcgPlayerResult.price}`);
    }

    // 2. PriceCharting (Puppeteer-based)
    console.log('[English OP] Fetching from PriceCharting...');
    const pcResult = await fetchPriceChartingPrice(card.number);
    if (pcResult !== null) {
      results.push({ price: pcResult.price, source: 'pricecharting', grade: 'raw' });
      console.log(`[English OP] PriceCharting: $${pcResult.price}`);
      if (pcResult.gradedPrice) {
        results.push({ price: pcResult.gradedPrice, source: 'pricecharting', grade: 'psa10' });
        console.log(`[English OP] PriceCharting PSA 10: $${pcResult.gradedPrice}`);
      }
    }
    
    if (results.length > 0) {
      console.log(`[English OP] Successfully fetched ${results.length} price points.`);
      
      const rawPrices = results.filter(r => r.grade === 'raw').map(r => r.price);
      let ttlPrice = 0;
      if (rawPrices.length > 0) {
        const lowestPrice = Math.min(...rawPrices);
        ttlPrice = Math.round(lowestPrice * 100);
      }
      
      const updatePayload: any = {
        last_price_fetch: new Date().toISOString()
      };
      if (ttlPrice > 0) updatePayload.price_cache_ttl = ttlPrice;

      // If we got a successful TCGPlayer match, save it permanently
      if (tcgPlayerResult !== null) {
        updatePayload.tcg_player_id = String(tcgPlayerResult.tcgProductId);
        if (tcgPlayerResult.tcgProductName) {
          const printRunInfo = { ...(card.print_run_info as any || {}) };
          printRunInfo.tcgplayer_card_name = tcgPlayerResult.tcgProductName;
          updatePayload.print_run_info = printRunInfo;
        }
      }

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
      
      await supabase.from('price_cache').upsert({
        card_id: card.id,
        variant_id: null,
        raw_prices: cacheRawPrices,
        graded_prices: cacheGradedPrices,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'card_id' });
        
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
          console.error(`[English OP] Failed to insert ${result.source} ${result.grade} price for ${card.number}:`, insertError);
        }
      }
    } else {
      console.log(`[English OP] Failed to find any prices, skipping...`);
      await supabase
        .from('cards')
        .update({ last_price_fetch: new Date().toISOString() })
        .eq('id', card.id);
    }
    
    console.log(`[English OP] Sleeping for ${SLEEP_MS / 1000}s... Zzz...\n`);
    await new Promise(r => setTimeout(r, SLEEP_MS));
  }
}

run();
