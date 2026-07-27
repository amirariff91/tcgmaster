import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SECRET_KEY as string);

const COMPANY_UUIDS_TO_SLUG: Record<string, string> = {
  '74c51627-cc4b-4a82-a1c0-52b3975b47b7': 'psa',
  'cda2045f-5d78-49e7-b1c8-de04dac9888d': 'bgs',
  'dce6169f-8958-4229-861b-686a4644c984': 'cgc',
  '7a7b5849-788b-40f6-9f42-14f2f27f68b3': 'sgc'
};
async function testLink(url: string, source: string): Promise<boolean> {
  if (!url) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, {
      method: 'GET',
      headers: source === 'pricecharting' ? undefined : { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return res.status === 200 || res.status === 403;
  } catch (e) {
    return false;
  }
}

async function rebuildPriceCache(cardId: string) {
  const { data: history } = await supabase.from('price_history').select('*').eq('card_id', cardId).order('recorded_at', { ascending: false });
  if (!history || history.length === 0) return null;

  const rawPrices: Record<string, number> = {};
  const gradedPrices: Record<string, Record<string, number>> = {};
  
  const seenRaw = new Set<string>();
  const seenGraded = new Set<string>();

  for (const h of history) {
    if (h.grade === 'raw') {
      if (!seenRaw.has(h.source)) {
        rawPrices[h.source] = h.price;
        seenRaw.add(h.source);
      }
    } else {
      const companySlug = COMPANY_UUIDS_TO_SLUG[h.grading_company_id] || h.grading_company_id || 'psa';
      const key = `${companySlug}-${h.grade}`;
      const uniqueSourceKey = `${key}-${h.source}`;
      
      if (!seenGraded.has(uniqueSourceKey)) {
        if (!gradedPrices[key]) gradedPrices[key] = {};
        gradedPrices[key][h.source] = h.price;
        seenGraded.add(uniqueSourceKey);
      }
    }
  }
  
  if (Object.keys(rawPrices).length > 0) {
    rawPrices.market = Math.min(...Object.values(rawPrices));
  }

  return { raw_prices: rawPrices, graded_prices: gradedPrices };
}

async function run() {
  console.log('🌟 Starting Data Curation & Integrity Pipeline 🌟');
  
  while (true) {
    try {
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, slug, name, snkrdunk_url, pricecharting_url, curation_status')
        .like('slug', 'op-%-ja')
        .eq('historical_fetched', true)
        .eq('curation_status', 'pending')
        .limit(20);

      if (error) {
        console.error('Error fetching cards:', error);
        await new Promise(r => setTimeout(r, 60000));
        continue;
      }

      if (!cards || cards.length === 0) {
        console.log('No cards to curate right now. Sleeping for 5 minutes...');
        await new Promise(r => setTimeout(r, 300000));
        continue;
      }
      
      let successCount = 0;
      for (const card of cards) {
        console.log(`\nCurating ${card.slug} (${card.name})...`);
        
        let snkrValid = true;
        let pcValid = true;
        if (card.snkrdunk_url) {
          snkrValid = await testLink(card.snkrdunk_url, 'snkrdunk');
          if (!snkrValid) console.log(`  ❌ Snkrdunk URL failed validation!`);
        }
        if (card.pricecharting_url) {
          pcValid = await testLink(card.pricecharting_url, 'pricecharting');
          if (!pcValid) console.log(`  ❌ PriceCharting URL failed validation!`);
        }
        
        if (!snkrValid || !pcValid) {
          // Mark as failed or skip so it doesn't get stuck in a loop forever
          await supabase.from('cards').update({ curation_status: 'failed' }).eq('id', card.id);
          continue;
        }
        
        console.log(`  ✓ Rebuilding perfect Price Cache from history...`);
        const newCache = await rebuildPriceCache(card.id);
        if (!newCache) {
          console.log(`  ❌ No price history found to build cache!`);
          await supabase.from('cards').update({ curation_status: 'failed' }).eq('id', card.id);
          continue;
        }
        
        const rawSourcesCount = Object.keys(newCache.raw_prices).filter(k => k !== 'market').length;
        const hasGraded = Object.keys(newCache.graded_prices).length > 0;

        if (rawSourcesCount < 2) {
          console.log(`  ❌ Failed Strict Gate: Only ${rawSourcesCount} raw source(s) found. Need 2+`);
          await supabase.from('cards').update({ curation_status: 'failed' }).eq('id', card.id);
          continue;
        }
        
        if (!hasGraded) {
          console.log(`  ❌ Failed Strict Gate: No graded data found.`);
          await supabase.from('cards').update({ curation_status: 'failed' }).eq('id', card.id);
          continue;
        }
        
        await supabase.from('price_cache').upsert({
          card_id: card.id,
          raw_prices: newCache.raw_prices,
          graded_prices: newCache.graded_prices,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
        
        await supabase.from('cards').update({ curation_status: 'curated' }).eq('id', card.id);
        console.log(`  🌟 Successfully Curated ${card.slug}!`);
        successCount++;
        
        // Sleep a tiny bit to not hammer Supabase or Cloudflare
        await new Promise(r => setTimeout(r, 2000));
      }
      
      console.log(`\nBatch finished. Successfully curated ${successCount} cards.`);
    } catch (e) {
      console.error('Fatal error in pipeline loop:', e);
      await new Promise(r => setTimeout(r, 60000));
    }
  }
}

run();
