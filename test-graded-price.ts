import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: cards } = await supabase
    .from('cards')
    .select('id, slug, name')
    .eq('slug', 'op-op08-084-ja')
    .single();
    
  if (cards) {
    const { data: prices } = await supabase
      .from('price_history')
      .select('grade, source, price, created_at')
      .eq('card_id', cards.id)
      .limit(10);
      
    console.log('Prices:', prices);
    
    const { data: cache } = await supabase
      .from('price_cache')
      .select('raw_prices, graded_prices')
      .eq('card_id', cards.id)
      .single();
      
    console.log('Cache:', cache);
  }
}
main();
