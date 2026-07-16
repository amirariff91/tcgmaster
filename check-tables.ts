import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data, error } = await supabase.rpc('get_tables');
  if (error) {
     const { data: d } = await supabase.from('price_history').select('*').limit(1);
     console.log("fallback");
  } else {
    console.log(data);
  }
}
run();
