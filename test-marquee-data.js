require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing env vars in .env.local, trying .env");
  require('dotenv').config({ path: '.env' });
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, image_url, slug, rarity')
    .not('image_url', 'is', null)
    .or('slug.ilike.op-%,slug.ilike.dbfw-%')
    .or('rarity.ilike.%manga%,rarity.ilike.%sp%,rarity.ilike.%tournament%,rarity.ilike.%wanted%,rarity.ilike.%scr%,rarity.ilike.%sec%')
    .limit(60);
    
  console.log('Error:', error);
  console.log('Total high rarity cards found:', data?.length);
  if (data?.length < 60) {
    console.log("Not enough cards! This explains the missing gaps.");
  }
}
run();
