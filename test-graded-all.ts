import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: cacheRecords } = await supabase
    .from('price_cache')
    .select('card_id, graded_prices')
    .neq('graded_prices', '{}' as any)
    .not('graded_prices', 'is', null)
    .limit(10);
    
  console.log("Caches with non-empty graded_prices:", cacheRecords?.length);
  if (cacheRecords && cacheRecords.length > 0) {
    console.log("Example:", JSON.stringify(cacheRecords[0].graded_prices, null, 2));
    const { data: card } = await supabase.from('cards').select('slug').eq('id', cacheRecords[0].card_id).single();
    console.log("Slug:", card?.slug);
  }
}
main();
