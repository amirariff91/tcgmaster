import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const slugs = [
    'op-op12-020_p3-ja',
    'op-eb03-061_p2-ja',
    'op-op13-118_p3-ja',
    'op-eb03-053_p2-ja'
  ];
  
  const { data, error } = await supabase
    .from('cards')
    .select('name, slug, image_url')
    .in('slug', slugs);

  if (error) {
    console.error(error);
  } else {
    data.forEach(c => console.log(`${c.slug} => ${c.image_url}`));
  }
}

run();
