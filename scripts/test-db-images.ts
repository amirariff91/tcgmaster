import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: en } = await supabase.from('cards').select('slug, image_url, local_image_url').ilike('slug', 'op-%').not('slug', 'ilike', '%-ja').limit(5);
  const { data: ja } = await supabase.from('cards').select('slug, image_url, local_image_url').ilike('slug', 'op-%-ja').limit(5);
  console.log("English:", en);
  console.log("Japanese:", ja);
}
run();
