import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const badSlugs = ['op-op05-119_p7', 'op-op05-119_p8', 'op-op05-119_r2', 'op-op13-120_p1'];
  const { data: cards } = await supabase.from('cards').select('id, slug').in('slug', badSlugs);
  if (!cards) return;
  for (const c of cards) {
    const { data: cp } = await supabase.from('card_prices').select('*').eq('card_id', c.id);
    console.log(`Prices for ${c.slug}:`, cp);
  }
}
run();
