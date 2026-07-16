import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const slugs = ['op-op13-120_p1', 'op-op05-119_r2', 'op-op05-119_p8', 'op-op05-119_p7'];
  const { data, error } = await supabase.from('cards').select('id, name, slug, number, rarity, image_url, set_id').in('slug', slugs);
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
run();
