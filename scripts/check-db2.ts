import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data } = await supabase
    .from('cards')
    .select(`
      id, name, price_cache_ttl
    `)
    .order('price_cache_ttl', { ascending: false, nullsFirst: false })
    .limit(5);
    
  console.log(JSON.stringify(data, null, 2));
}

run();
