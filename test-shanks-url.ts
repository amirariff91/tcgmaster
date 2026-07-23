import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: cards } = await supabase
    .from('cards')
    .select('id, name, slug, snkrdunk_url')
    .ilike('name', '%manga%')
    .ilike('slug', 'op-%-ja')
    .not('snkrdunk_url', 'is', null)
    .limit(3);
    
  console.log('Cards:', cards);
}
main();
