import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: op } = await supabase.from('sets').select('slug, name').ilike('slug', 'op%');
  console.log("One Piece Sets:", op);
  const { data: db } = await supabase.from('sets').select('slug, name').ilike('slug', 'db%');
  console.log("DBFW Sets:", db);
}
run();
