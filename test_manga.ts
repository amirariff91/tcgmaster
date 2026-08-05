import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data } = await supabase.from('cards')
    .select('id, slug, name, snkrdunk_url, yuyutei_url, curation_status')
    .like('slug', 'op-%-ja')
    .ilike('name', '%Manga Alternate Art%')
    .order('set_id', { ascending: false });
  console.log(data);
}
run();
