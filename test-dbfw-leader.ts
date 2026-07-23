import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, name, number, rarity')
    .ilike('slug', 'dbfw-%')
    .limit(10);
  console.log(cards);
}
main();
