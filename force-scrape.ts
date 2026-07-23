import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: card } = await supabase.from('cards').select('id, number, snkrdunk_url').eq('slug', 'op-op08-084-ja').single();
  if (!card) return console.log("Card not found");
  
  // Set last_price_fetch to null so the scraper picks it up NEXT!
  await supabase.from('cards').update({ last_price_fetch: null }).eq('id', card.id);
  console.log("Reset last_price_fetch for", card.number);
}
run();
