import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data } = await supabase
    .from('cards')
    .select('id, name, rarity, language, slug, number')
    .not('image_url', 'is', null)
    .or('rarity.ilike.%manga%,rarity.ilike.%sp%,rarity.ilike.%tournament%,rarity.ilike.%wanted%,rarity.ilike.%scr%,rarity.ilike.%sec%');
  
  console.log('Total high rarity:', data?.length);
  const rarities = new Set(data?.map(d => d.rarity));
  console.log('Rarities found:', Array.from(rarities));
}
run();
