import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function main() {
  const { data: sets } = await supabase.from('sets').select('*').ilike('name', '%Dual%');
  console.log('Sets matching Dual:', sets);
  const { data: cards } = await supabase.from('cards').select('*').ilike('name', '%Piccolo : SH%');
  console.log('Cards matching Piccolo : SH:', cards?.map(c => ({id: c.id, name: c.name, number: c.number, set: c.set_id})));
}
main();
