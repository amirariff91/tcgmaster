import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function main() {
  const { data: cards } = await supabase.from('cards').select('id, name, number, set_id').ilike('number', '%FB09%');
  console.log('Cards matching FB09:', cards?.length);
  const { data: sets } = await supabase.from('sets').select('id, name, slug').ilike('slug', 'dbfw-%');
  console.log('All DBFW sets:', sets?.length);
}
main();
