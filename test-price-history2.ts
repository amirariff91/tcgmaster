import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data, error } = await supabase.from('price_history')
    .select('*')
    .eq('card_id', '320c47b7-6f0c-4bd9-91c7-beb6188291eb')
    .order('recorded_at', { ascending: false })
    .limit(5);
  if (error) console.log(error);
  else console.log(data);
}
run();
