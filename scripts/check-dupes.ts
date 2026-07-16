import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('sets').select('id, name, slug').ilike('slug', 'op-%');
  const names = (data || []).map(s => s.name);
  console.log("Names:", names);
}
run();
