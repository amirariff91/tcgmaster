import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('sets').select('name').ilike('slug', 'op-%');
  const badNames = (data || []).filter(s => s.name.toLowerCase().includes('booster') || s.name.match(/[ぁ-んァ-ン一-龥]/));
  console.log("Sets with 'Booster' or Japanese chars:", badNames);
}
run();
