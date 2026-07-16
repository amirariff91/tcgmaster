import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('cards').select('sets!inner(name, games!inner(slug))').limit(1);
  console.log(JSON.stringify(data, null, 2));
}
run();
