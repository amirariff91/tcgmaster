import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data } = await supabase.from('price_history').select('*').eq('card_id', 'op-op08-084-ja').order('recorded_at', { ascending: true });
  console.log(JSON.stringify(data, null, 2));
}
run();
