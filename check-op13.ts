import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data: cards } = await supabase.from('cards').select('id, slug').eq('slug', 'op-op13-120_p1');
  if (cards && cards.length > 0) {
    const { data } = await supabase.from('price_history').select('*').eq('card_id', cards[0].id);
    console.log(data);
  }
}
run();
