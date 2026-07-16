import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: en } = await supabase.from('cards').select('slug, tcg_player_id').ilike('slug', 'op-%').not('tcg_player_id', 'is', null).limit(5);
  console.log("English OP:", en);
  const { data: ja } = await supabase.from('cards').select('slug, tcg_player_id').ilike('slug', 'op-%').is('tcg_player_id', null).limit(5);
  console.log("Japanese OP:", ja);
}
run();
