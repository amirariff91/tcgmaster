import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function main() {
  const { data } = await supabase.rpc('calculate_deck_price', { deck_id: '263480c4-dead-4bdc-ac8f-5412f7d46baf' });
  console.log('calculate_deck_price:', data);
}
main();
