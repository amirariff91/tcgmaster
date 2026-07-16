import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('cards').select('slug, name, number').eq('number', 'OP02-034');
  console.log("Matches for OP02-034:", data);
}
run();
