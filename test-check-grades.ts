import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: card } = await supabase
    .from('cards')
    .select('id, name, price_cache ( raw_prices, graded_prices ), price_history ( grade, price, source, recorded_at )')
    .eq('slug', 'op-op08-084-ja')
    .single();
    
  console.log('Card:', card?.name);
  console.log('Price Cache:', JSON.stringify(card?.price_cache, null, 2));
  
  if (card?.price_history) {
    const grades = [...new Set(card.price_history.map(h => h.grade))];
    console.log('Grades in history:', grades);
  }
}
main();
