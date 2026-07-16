import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('cards').select('slug, name').ilike('slug', '%ja%').limit(10);
  console.log("With -ja:", data);
  const { data: en } = await supabase.from('cards').select('slug, name').ilike('slug', '%en%').limit(10);
  console.log("With -en:", en);
}
run();
