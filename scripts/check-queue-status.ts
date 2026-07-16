import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data: enNulls } = await supabase
    .from('cards')
    .select('id', { count: 'exact' })
    .ilike('slug', 'op-%')
    .not('slug', 'ilike', '%-ja')
    .is('last_price_fetch', null);
    
  console.log(`English OP cards with NULL fetch: ${enNulls?.length || 0}`);
  
  const { data: jaNulls } = await supabase
    .from('cards')
    .select('id', { count: 'exact' })
    .ilike('slug', 'op-%')
    .ilike('slug', '%-ja')
    .is('last_price_fetch', null);
    
  console.log(`Japanese OP cards with NULL fetch: ${jaNulls?.length || 0}`);
  
  // Let's also see what the query ACTUALLY returns for limit(5)
  const { data: nextQueue } = await supabase
      .from('cards')
      .select('id, name, slug, last_price_fetch')
      .or('slug.ilike.op-%')
      .order('last_price_fetch', { ascending: true, nullsFirst: true })
      .limit(5);
  console.log("Next 5 in queue:", nextQueue);
}
run();
