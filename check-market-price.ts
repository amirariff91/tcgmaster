import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data } = await supabase.from('cards').select('slug, market_price').in('slug', ['op-op05-119_p7', 'op-op05-119_p8', 'op-op05-119_r2', 'op-op13-120_p1']);
  console.log(data);
}
run();
