import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, image_url, slug, rarity')
    .not('image_url', 'is', null)
    .or('slug.ilike.op-%,slug.ilike.dbfw-%')
    .or('rarity.ilike.%manga%,rarity.ilike.%sp%,rarity.ilike.%tournament%,rarity.ilike.%wanted%,rarity.ilike.%scr%,rarity.ilike.%sec%')
    .limit(60);
    
  console.log('Error:', error);
  console.log('Returned length:', data?.length);
  if (data && data.length > 0) {
    console.log('Sample images:');
    data.slice(0, 5).forEach(c => console.log(c.slug, c.image_url));
  } else {
      console.log("No data returned, lets test without rarity filter.");
      const { data: data2 } = await supabase.from('cards').select('id').not('image_url', 'is', null).or('slug.ilike.op-%,slug.ilike.dbfw-%').limit(60);
      console.log("Without rarity filter:", data2?.length);
  }
}
run();
