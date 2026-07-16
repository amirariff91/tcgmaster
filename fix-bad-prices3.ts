import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data: cards } = await supabase.from('cards').select('id, slug').eq('slug', 'op-op13-120_p1');
  
  if (cards) {
    for (const c of cards) {
      await supabase.from('price_history').delete().eq('card_id', c.id);
      console.log(`Cleared rogue price history for ${c.slug}`);
    }
  }
}
run();
