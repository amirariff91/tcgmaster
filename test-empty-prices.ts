import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { count: dbfwCount } = await supabase.from('cards').select('*, price_cache!inner(*)', { count: 'exact', head: true }).ilike('slug', 'dbfw-%');
  const { count: dbfwTotal } = await supabase.from('cards').select('*', { count: 'exact', head: true }).ilike('slug', 'dbfw-%');
  
  const { count: opCount } = await supabase.from('cards').select('*, price_cache!inner(*)', { count: 'exact', head: true }).ilike('slug', 'op-%');
  const { count: opTotal } = await supabase.from('cards').select('*', { count: 'exact', head: true }).ilike('slug', 'op-%');
  
  const { count: pkmnCount } = await supabase.from('cards').select('*, price_cache!inner(*)', { count: 'exact', head: true }).ilike('slug', 'pokemon-%');
  const { count: pkmnTotal } = await supabase.from('cards').select('*', { count: 'exact', head: true }).ilike('slug', 'pokemon-%');
  
  console.log(`DBFW: ${dbfwCount} prices / ${dbfwTotal} total`);
  console.log(`OP: ${opCount} prices / ${opTotal} total`);
  console.log(`PKMN: ${pkmnCount} prices / ${pkmnTotal} total`);
}
run();
