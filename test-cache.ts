import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data, count } = await supabase.from('price_cache').select('id', { count: 'exact' });
  console.log('Total prices in cache:', count);
}
run();
