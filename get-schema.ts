import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: priceCache } = await supabase.from('price_cache').select('updated_at').limit(10);
  const { data: artists } = await supabase.from('cards').select('artist').not('artist', 'is', null);
  const uniqueArtists = new Set(artists?.map(a => a.artist)).size;
  console.log("Unique artists:", uniqueArtists);
}
run();
