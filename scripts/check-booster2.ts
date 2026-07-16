import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('sets').select('id, name, slug, game_id').ilike('name', '%BOOSTER PACK%');
  console.log(data);
}
run();
