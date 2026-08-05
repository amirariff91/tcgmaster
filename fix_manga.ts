import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data } = await supabase.from('cards')
    .select('id, slug, name, print_run_info')
    .like('slug', 'op-%-ja')
    .ilike('name', '%Manga Alternate Art%');
    
  for (const card of data || []) {
    const tcgName = (card.print_run_info as any)?.tcgplayer_card_name || '';
    const isActuallyManga = tcgName.toLowerCase().includes('manga');
    console.log(`${isActuallyManga ? '✅' : '❌'} ${card.slug} | ${card.name} | TCG: ${tcgName}`);
  }
}
run();
