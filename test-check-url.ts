import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: card } = await supabase
    .from('cards')
    .select('id, name, snkrdunk_url')
    .eq('slug', 'op-op08-084-ja')
    .single();
    
  console.log('Card:', card);
}
main();
