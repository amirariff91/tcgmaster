import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: sets } = await supabase
    .from('sets')
    .select('id, slug, name')
    .ilike('slug', 'dbfw-%')
    .order('slug', { ascending: true });
  console.log(sets);
}
main();
