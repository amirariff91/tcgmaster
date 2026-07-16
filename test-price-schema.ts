import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data, error } = await supabase.from('historical_prices').select('*').limit(1);
  if (error) console.log('historical_prices error:', error.message);
  else console.log('historical_prices:', Object.keys(data[0] || {}));
}
run();
