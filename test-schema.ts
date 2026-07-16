import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data } = await supabase.from('cards').select('*').limit(1);
  console.log(Object.keys(data?.[0] || {}));
}
run();
