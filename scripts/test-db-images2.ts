import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: ja } = await supabase.from('cards').select('slug, image_url, local_image_url').ilike('slug', 'op-%-ja').not('image_url', 'is', null).limit(10);
  console.log("Japanese with images:", ja);
  const { count } = await supabase.from('cards').select('*', { count: 'exact', head: true }).ilike('slug', 'op-%-ja').not('image_url', 'is', null);
  console.log("Total Japanese with images:", count);
}
run();
