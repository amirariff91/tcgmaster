import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data } = await supabase.from('cards').select('slug, snkrdunk_url, yuyutei_url, pricecharting_url, curation_status').in('slug', ['op-op01-120_p2-ja']);
  console.log(data);
}
run();
