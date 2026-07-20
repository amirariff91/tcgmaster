import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await supabase.from('decks').select('leader_card_id, player_name, tournaments(name)');
  console.log("Total Decks:", data?.length);
  
  const uniqueLeaders = new Set(data?.map(d => d.leader_card_id).filter(Boolean));
  console.log("Unique Leaders:", uniqueLeaders.size);
  
  console.log(data);
}
run();
