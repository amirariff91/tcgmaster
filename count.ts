import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { count: dbfwCount } = await supabase.from('cards').select('*', { count: 'exact', head: true }).ilike('slug', 'dbfw-%');
  const { count: opCount } = await supabase.from('cards').select('*', { count: 'exact', head: true }).ilike('slug', 'op-%');
  console.log('DBFW Cards:', dbfwCount);
  console.log('OP Cards:', opCount);
}
run();
