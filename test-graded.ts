import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: cards } = await supabase
    .from('cards')
    .select('id, slug, name, price_cache(graded_prices, raw_prices)')
    .eq('slug', 'op-op08-084-ja')
    .single();
    
  if (cards) {
    const dbPriceCache = Array.isArray(cards.price_cache) ? cards.price_cache[0] : cards.price_cache;
    console.log("DB Cache Graded Prices:", JSON.stringify(dbPriceCache?.graded_prices, null, 2));

    const gradedPrices: any = {};
    if (dbPriceCache?.graded_prices) {
      for (const [grade, sources] of Object.entries(dbPriceCache.graded_prices)) {
        if (sources && typeof sources === 'object') {
          const prices = Object.values(sources).filter(v => typeof v === 'number') as number[];
          if (prices.length > 0) {
            gradedPrices[grade] = {
              average: Math.min(...prices),
              median: null,
              low: Math.min(...prices),
              high: Math.max(...prices),
              count: prices.length
            };
          }
        }
      }
    }
    
    console.log("Transformed gradedPrices:", JSON.stringify(gradedPrices, null, 2));
    
    const priceLadderEntries = [
      { grade: '7', grading_company: 'psa', price: gradedPrices.psa7?.average || 0 },
      { grade: '8', grading_company: 'psa', price: gradedPrices.psa8?.average || 0 },
      { grade: '9', grading_company: 'psa', price: gradedPrices.psa9?.average || 0 },
      { grade: '10', grading_company: 'psa', price: gradedPrices.psa10?.average || 0 },
    ].filter(e => e.price > 0);
    
    console.log("priceLadderEntries:", JSON.stringify(priceLadderEntries, null, 2));
  }
}
main();
