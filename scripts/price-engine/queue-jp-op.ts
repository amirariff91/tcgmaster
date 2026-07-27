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
      .select('id, name, slug, number, yuyutei_url, snkrdunk_url, pricecharting_url')
      .like('slug', 'op-%')
      .like('slug', '%-ja')
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
    const snkrdunkResult = await fetchSnkrdunkPrice(card.snkrdunk_url || `${card.name} ${card.number} One Piece`);
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
    
    let pcQueryOrUrl = card.pricecharting_url;
    if (!pcQueryOrUrl) {
      // Deterministically construct the URL instead of fuzzy searching
      let setSlug = card.slug.split('-')[1]; // e.g. op-op01-001-ja -> op01
      if (setSlug === 'p' || card.number.startsWith('P-')) setSlug = 'promo';
      
      const cleanName = card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const cleanNum = card.number.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      pcQueryOrUrl = `https://www.pricecharting.com/game/one-piece-japanese-${setSlug}/${cleanName}-${cleanNum}`;
    }

    const pcResult = await fetchPriceChartingPrice(pcQueryOrUrl);
    if (pcResult !== null) {
      results.push({ price: pcResult.price, source: 'pricecharting', grade: 'raw' });
      console.log(`[Japanese OP] PriceCharting: $${pcResult.price}`);
      if (pcResult.gradedPrice) {
        results.push({ price: pcResult.gradedPrice, source: 'pricecharting', grade: 'psa10' });
        console.log(`[Japanese OP] PriceCharting PSA 10: $${pcResult.gradedPrice}`);
      }
      if (pcResult.url && pcResult.url !== card.pricecharting_url) {
        updatePayload.pricecharting_url = pcResult.url;
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
      
      // Only trigger a re-curation if we discovered or changed a source URL
      if (updatePayload.snkrdunk_url || updatePayload.pricecharting_url || updatePayload.yuyutei_url) {
        updatePayload.curation_status = 'pending';
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
      }).throwOnError();

      for (const result of results) {
        let finalGrade = result.grade;
        let finalCompany = null;
        if (finalGrade.startsWith('psa')) {
          finalCompany = '74c51627-cc4b-4a82-a1c0-52b3975b47b7';
          finalGrade = finalGrade.replace('psa', '');
        } else if (finalGrade.startsWith('bgs')) {
          finalCompany = 'cda2045f-5d78-49e7-b1c8-de04dac9888d';
          finalGrade = finalGrade.replace('bgs', '');
        }
        
        const { error: insertError } = await supabase
          .from('price_history')
          .insert({
            card_id: card.id,
            price: result.price,
            source: result.source,
            grade: finalGrade,
            grading_company_id: finalCompany
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

