import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, price_cache!inner(raw_prices)')
    .order('price_cache(raw_prices->>market)', { ascending: false })
    .limit(5);
  console.log(error ? error : data);
}
run();
