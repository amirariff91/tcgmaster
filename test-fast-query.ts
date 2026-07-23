import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("No env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.time('Fast Query');
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, image_url, local_image_url, slug, rarity')
    .not('image_url', 'is', null)
    .limit(2000); // Just fetch 2000 random cards and filter in memory!
  console.timeEnd('Fast Query');
  console.log(`Returned ${data?.length || 0} cards. Error:`, error?.message);
}

run();
