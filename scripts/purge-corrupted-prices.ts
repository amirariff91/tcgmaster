import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  console.log("Purging corrupted One Piece English prices...");
  
  // Update all english OP cards (slugs without -ja)
  const { data, error } = await supabase
    .from('cards')
    .update({
      price_cache_ttl: null,
      last_price_fetch: null
    })
    .ilike('slug', 'op-%')
    .not('slug', 'ilike', '%-ja');
    
  if (error) {
    console.error("Error purging prices:", error);
  } else {
    console.log("Prices successfully purged. The scraper will now re-queue these cards.");
  }
}
run();
