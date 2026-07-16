import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: dbfw } = await supabase.from('cards').select('slug, name, tcg_player_id').ilike('slug', 'dbfw%').limit(5);
  console.log("DBFW Cards:", dbfw);
  
  const { data: op } = await supabase.from('cards').select('slug, name, tcg_player_id').ilike('slug', 'op-%').limit(5);
  console.log("OP Cards:", op);
}
run();
