import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  console.time('Full Table Scan Query');
  const { data, error } = await supabase
    .from('cards')
    .select('id')
    .not('image_url', 'is', null)
    .or('rarity.ilike.%sp%,rarity.ilike.%sec%,rarity.ilike.%scr%,name.ilike.%manga%,name.ilike.%tournament%,name.ilike.%wanted%')
    .limit(500);
  console.timeEnd('Full Table Scan Query');
  console.log(`Returned ${data?.length || 0} cards. Error:`, error?.message);
}

run();
