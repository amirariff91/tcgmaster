import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: op } = await supabase.from('cards').select('name, number').ilike('slug', 'op-%-ja').limit(3);
  console.log("OP JA:", op);
  const { data: dbfw } = await supabase.from('cards').select('name, number').ilike('slug', 'dbfw-%-ja').limit(3);
  console.log("DBFW JA:", dbfw);
}
run();
