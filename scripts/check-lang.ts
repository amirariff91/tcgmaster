import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('cards').select('slug, name, set_id, sets(name, slug)').limit(10);
  console.log(JSON.stringify(data, null, 2));
}
run();
