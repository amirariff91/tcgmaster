import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: sets } = await supabase.from('sets').select('slug').ilike('slug', 'op-%');
  console.log(`Total OP Sets: ${sets?.length}`);
  const { count: opCount } = await supabase.from('cards').select('*', { count: 'exact', head: true }).ilike('slug', 'op-%');
  console.log(`Total OP Cards: ${opCount}`);
}
run();
