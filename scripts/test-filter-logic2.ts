import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: opCards } = await supabase.from('cards').select('slug, tcg_player_id').ilike('slug', 'op-%');
  console.log(`Total OP Cards: ${opCards?.length}`);
  const withTcg = opCards?.filter(c => c.tcg_player_id !== null).length;
  console.log(`With TCGPlayer ID: ${withTcg}`);
}
run();
