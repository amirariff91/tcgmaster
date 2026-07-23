import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: card } = await supabase.from('cards').select('id').eq('slug', 'op-op08-084-ja').single();
  if (!card) return;
  
  await supabase.from('price_history').insert([
    { card_id: card.id, price: 50, source: 'snkrdunk', grade: 'psa10' },
    { card_id: card.id, price: 45, source: 'pricecharting', grade: 'psa10' },
    { card_id: card.id, price: 30, source: 'snkrdunk', grade: 'psa9' }
  ]);
  
  await supabase.from('price_cache').upsert({
    card_id: card.id,
    variant_id: null,
    raw_prices: { yuyutei: 5 },
    graded_prices: {
      psa10: { snkrdunk: 50, pricecharting: 45 },
      psa9: { snkrdunk: 30 }
    },
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  
  console.log("Injected fake graded data for Jack OP08-084!");
}
run();
