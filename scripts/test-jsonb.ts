import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data: cards } = await supabase.from('cards').select('id, print_run_info').limit(1);
  if (cards && cards.length > 0) {
    const cardId = cards[0].id;
    const { error } = await supabase.from('cards').update({ print_run_info: { language: 'en' } }).eq('id', cardId);
    console.log("Update Error:", error);
    const { data: updated } = await supabase.from('cards').select('print_run_info').eq('id', cardId);
    console.log("Updated Value:", updated);
  }
}
run();
