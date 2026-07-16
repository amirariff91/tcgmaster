import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('cards')
    .select('name, slug, image_url')
    .ilike('slug', '%op01-025%')
    .not('image_url', 'is', null)
    .limit(5);

  if (error) console.error(error);
  else console.log(data?.map(c => `${c.name} - ${c.slug} - ${c.image_url}`).join('\n'));
}

run();
