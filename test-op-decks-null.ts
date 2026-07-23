import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: decks, error } = await supabase
    .from('decks')
    .select('id, leader_card_id, tournaments!inner(games!inner(slug))')
    .is('leader_card_id', null)
    .eq('tournaments.games.slug', 'one-piece');
    
  console.log('Null leader OP decks count:', decks?.length, error);
}
main();
