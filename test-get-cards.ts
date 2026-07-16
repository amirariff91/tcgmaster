import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('cards').select('image_url').limit(20);
  console.log(data);
}
run();
