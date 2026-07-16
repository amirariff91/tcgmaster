import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, set_id, tcgplayer_url, snkrdunk_url, cardrush_url, yuyutei_url')
    .limit(10);
    
  console.log(data);
}
main();
