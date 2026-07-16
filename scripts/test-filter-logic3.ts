import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: opCards } = await supabase.from('cards').select('slug').ilike('slug', 'op-%');
  const ja = opCards?.filter(c => c.slug.includes('-ja')).length;
  const en = opCards?.filter(c => c.slug.includes('-en')).length;
  console.log(`With -ja: ${ja}, With -en: ${en}`);
}
run();
