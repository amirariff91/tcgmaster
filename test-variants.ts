import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { count } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .like('slug', 'op-%_%')
    .not('slug', 'like', '%-ja');
    
  console.log("Total EN variants:", count);
}
run();
