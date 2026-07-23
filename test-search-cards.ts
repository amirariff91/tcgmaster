import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data } = await supabase
    .from('cards')
    .select('number, name')
    .or('number.ilike.FB07%,number.ilike.FB09%')
    .limit(10);
  console.log('Cards matching FB07 or FB09:', data);
}
main();
