import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: deckCards, error } = await supabase
    .from('deck_cards')
    .select('*')
    .eq('deck_id', '263480c4-dead-4bdc-ac8f-5412f7d46baf')
    .limit(10);
  console.log(deckCards);
}
main();
