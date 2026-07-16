import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const badSlugs = ['op-op13-120_p1', 'op-op05-119_r2', 'op-op05-119_p8', 'op-op05-119_p7'];
  const { data: cards } = await supabase.from('cards').select('id, slug').in('slug', badSlugs);
  
  if (cards) {
    for (const c of cards) {
      // Clear their current cached prices
      await supabase.from('card_prices').delete().eq('card_id', c.id);
      console.log(`Cleared cached prices for ${c.slug}`);
    }
  }
}
run();
