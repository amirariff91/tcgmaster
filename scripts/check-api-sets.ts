import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('sets').select('id, name, slug').eq('slug', 'op-op-07');
  console.log("Supabase direct:", data);

  // Lets fetch via localhost if server is running, or just read the DB
}
run();
