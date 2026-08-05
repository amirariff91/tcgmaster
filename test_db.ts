import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data } = await supabase.from('cards').select('name, slug, rarity').like('slug', '%_p2%').not('name', 'ilike', '%manga%').limit(5);
  console.log(data);
}
run();
