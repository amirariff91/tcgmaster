import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: card } = await supabase.from('cards').select('id, slug').eq('slug', 'op-op08-084-ja').single();
  if (!card) {
      console.log('card not found');
      return;
  }
  const { data } = await supabase.from('price_history').select('*').eq('card_id', card.id).order('recorded_at', { ascending: true });
  console.log(JSON.stringify(data, null, 2));
}
run();
