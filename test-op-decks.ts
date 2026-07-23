import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select('*, games!inner(slug)')
    .eq('games.slug', 'one-piece');
  console.log('One Piece Tournaments:', tournaments?.length, tErr);

  const { data: decks, error: dErr } = await supabase
    .from('decks')
    .select('*, tournaments!inner(games!inner(slug))')
    .eq('tournaments.games.slug', 'one-piece');
  console.log('One Piece Decks:', decks?.length, dErr);

  if (decks && decks.length > 0) {
    console.log('Sample deck:', decks[0]);
  }
}
main();
