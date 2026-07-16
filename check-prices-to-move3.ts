import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const goodSlugs = ['op-op05-119_p1', 'op-op05-119_p2'];
  const { data: goodCards } = await supabase.from('cards').select('id, slug, number').in('slug', goodSlugs);
  
  if (!goodCards) return console.log("No good cards found");
  
  for (const card of goodCards) {
     const { data: prices } = await supabase.from('price_history').select('*').eq('card_id', card.id);
     console.log(`Card ${card.slug} has ${prices?.length} price entries`);
     if (prices && prices.length > 0) {
        // Just print the first one for each source to see what price it was
        const uniqueSources = [...new Set(prices.map(p => p.source))];
        for (const s of uniqueSources) {
           const p = prices.find(x => x.source === s);
           console.log(`  ${s}: $${p?.price}`);
        }
     }
  }
}
run();
