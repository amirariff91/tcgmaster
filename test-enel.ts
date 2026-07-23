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
    .eq('slug', 'op-op10-025-ja')
    .single();
    
  console.log("Enel Card:", JSON.stringify(cards, null, 2));
}
main();
