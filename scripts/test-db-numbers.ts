import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function test() {
  const { data: cards, error } = await supabase
    .from('cards')
    .select('number, slug')
    .ilike('slug', 'op-%')
    .ilike('slug', '%-ja')
    .limit(10);
  
  console.log(cards);
}

test();
