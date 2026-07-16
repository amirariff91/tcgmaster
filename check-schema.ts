import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data, error } = await supabase.from('card_views').select('*').limit(1); // Maybe there's a view?
  if (error) console.log(error);
  console.log("Card views:", data);
}
run();
