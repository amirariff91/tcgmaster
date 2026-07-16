import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data: scrapedCards, error } = await supabase
    .from('cards')
    .select('id')
    .ilike('slug', 'op-%')
    .not('price_cache_ttl', 'is', null);
    
  console.log(`Scraped OP cards: ${scrapedCards?.length || 0}`);
  
  const { data: totalCards } = await supabase
    .from('cards')
    .select('id', { count: 'exact' })
    .ilike('slug', 'op-%');
    
  console.log(`Total OP cards: ${totalCards?.length || 0}`);
}
run();
