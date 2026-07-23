import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: decks, error: dErr } = await supabase
    .from('decks')
    .select('*, tournaments!inner(games!inner(slug)), cards(name, image_url, local_image_url)')
    .eq('tournaments.games.slug', 'dbfw')
    .in('placement', ['1st', '1', '2nd', '2', '3rd', '3', '4th', '4'])
    .order('created_at', { ascending: false })
    .limit(24);
  console.log('Decks length:', decks?.length, dErr);
  if (decks && decks.length > 0) {
    console.log('Sample:', decks[0]);
  }
}
main();
