import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { data } = await supabase.from('cards').select('slug, snkrdunk_url').eq('number', 'OP01-120_p2');
  console.log(data);
}
run();
