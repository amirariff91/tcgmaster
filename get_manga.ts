import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('cards')
    .select('id, slug, name, snkrdunk_url')
    .like('slug', 'op-%-ja')
    .ilike('name', '%Manga Alternate Art%')
    .is('snkrdunk_url', null);
    
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
