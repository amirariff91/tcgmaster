import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: cards } = await supabase.from('cards').select('*').limit(1);
  console.log("Card columns:", Object.keys(cards?.[0] || {}));
  const { data: sets } = await supabase.from('sets').select('*').limit(1);
  console.log("Set columns:", Object.keys(sets?.[0] || {}));
}
run();
