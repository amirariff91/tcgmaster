import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { error } = await supabase.from('price_history').insert({
    card_id: '4ecbb007-e451-4dc0-b51f-83b177156ecb',
    market_price: 10,
    source: 'test'
  });
  console.log(error);
}
run();
