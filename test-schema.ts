import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('price_cache')
    .select('graded_prices')
    .not('graded_prices', 'is', null)
    .limit(10);
    
  console.log('Sample graded_prices:', JSON.stringify(data, null, 2));
}
main();
