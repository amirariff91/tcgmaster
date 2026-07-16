import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('cards')
    .select('name, slug, image_url')
    .or('slug.ilike.%op05-060%,slug.ilike.%op09-050%,slug.ilike.%op01-025%,slug.ilike.%op10-111%,slug.ilike.%fb04-129%,slug.ilike.%fp-034%')
    .not('image_url', 'is', null);

  if (error) {
    console.error(error);
    return;
  }
  
  const valid = [];
  for (const c of data || []) {
    try {
      const res = await fetch(c.image_url, { method: 'HEAD' });
      if (res.ok) {
        valid.push(`${c.name} - ${c.slug} - ${c.image_url}`);
      }
    } catch (e) {}
  }
  console.log("VALID CARDS:\n" + valid.join('\n'));
}

run();
