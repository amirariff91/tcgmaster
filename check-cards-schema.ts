import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data, error } = await supabase.from('cards').select('*').limit(1);
  if (error) console.error(error);
  else console.log(Object.keys(data[0]));
}
run();
