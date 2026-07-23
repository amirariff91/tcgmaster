import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { fetchSnkrdunkPrice } from './lib/price-engine/snkrdunk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: card } = await supabase
    .from('cards')
    .select('id, name, slug, number, yuyutei_url, snkrdunk_url')
    .eq('slug', 'op-op08-084-ja')
    .single();
    
  if (!card) return;
  
  console.log(`Processing: ${card.name} (${card.number})`);
  
  const results: any[] = [];
  
  console.log('Fetching from SnkrDunk...');
  const snkrdunkResult = await fetchSnkrdunkPrice(card.snkrdunk_url || card.number);
  if (snkrdunkResult !== null) {
    results.push({ price: snkrdunkResult.price, source: 'snkrdunk', grade: 'raw' });
    console.log(`SnkrDunk: $${snkrdunkResult.price}`);
    if (snkrdunkResult.gradedPrice) {
      results.push({ price: snkrdunkResult.gradedPrice, source: 'snkrdunk', grade: 'psa10' });
      console.log(`SnkrDunk PSA 10: $${snkrdunkResult.gradedPrice}`);
    }
  }

  // Update logic mock
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
  
  for (const grade of Object.keys(cacheGradedPrices)) {
    const vals = Object.values(cacheGradedPrices[grade]) as number[];
    if (vals.length > 0) {
      cacheGradedPrices[grade].average = vals.reduce((a,b)=>a+b, 0) / vals.length;
    }
  }
  
  console.log("Mocked cacheGradedPrices:", JSON.stringify(cacheGradedPrices, null, 2));
  
  // Save to DB
  await supabase.from('price_cache').upsert({
    card_id: card.id,
    variant_id: null,
    raw_prices: cacheRawPrices,
    graded_prices: cacheGradedPrices,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }, { onConflict: 'card_id' });
  
  console.log("Saved to price_cache!");
  process.exit(0);
}
main();
