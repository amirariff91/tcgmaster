import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: cards } = await supabase
    .from('cards')
    .select('id, slug, name, price_history(*)')
    .eq('slug', 'op-op08-084-ja')
    .single();
    
  console.log("History length:", cards?.price_history?.length);
  const graded = cards?.price_history?.filter((h: any) => h.grade !== 'raw');
  console.log("Graded history:", graded?.length);
}
main();
