import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('cards').select('slug, image_url, local_image_url').ilike('slug', 'dbfw-%-ja').limit(5);
  console.log("DBFW Japanese:", data);
}
run();
