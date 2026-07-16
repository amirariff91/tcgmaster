import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('cards').select('id, print_run_info').limit(1);
  const cardId = data![0].id;
  // Let's pass an object directly rather than string
  const { error } = await supabase.from('cards').update({ print_run_info: { language: 'en' } }).eq('id', cardId);
  console.log("Update Error:", error);
}
run();
