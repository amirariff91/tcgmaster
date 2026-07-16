import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data, error } = await supabase.from('cards').select('id, name, print_run_info').contains('print_run_info', { language: 'en' });
  console.log("Error:", error);
  console.log("Filtered Data:", data);
}
run();
