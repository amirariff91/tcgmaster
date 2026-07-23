import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: decks } = await supabase
    .from('decks')
    .select('id, leader_card_id, total_price, cards(name), tournaments!inner(games!inner(slug))')
    .limit(10);
    
  console.log('Sample Decks:', decks);
}
main();
