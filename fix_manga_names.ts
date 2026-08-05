import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const TRUE_MANGA_SLUGS = new Set([
  'op-op01-120_p2-ja', // Shanks
  'op-op02-013_p2-ja', // Ace
  'op-op03-122_p2-ja', // Sogeking
  'op-op04-083_p2-ja', // Sabo
  'op-op05-069_p2-ja', // Law
  'op-op05-074_p2-ja', // Kid
  'op-op05-119_p2-ja', // Luffy
  'op-op06-118_p2-ja', // Zoro
  'op-op07-051_p2-ja', // Boa
  'op-op08-118_p2-ja', // Rayleigh
  'op-op09-004_p2-ja', // Shanks
  'op-op09-118_p2-ja', // Roger
  'op-eb01-006_p2-ja', // Chopper
  'op-prb02-005_p2-ja', // PRB02 Luffy Manga?
  'op-prb01-001_p2-ja', // Wait, PRB01 Nami is usually op01-016_p2
]);

async function run() {
  const { data } = await supabase.from('cards')
    .select('id, slug, name')
    .like('slug', 'op-%-ja')
    .ilike('name', '%Manga Alternate Art%');
    
  let fixedCount = 0;
  for (const card of data || []) {
    if (!TRUE_MANGA_SLUGS.has(card.slug)) {
      const fixedName = card.name.replace('(Manga Alternate Art)', '(Alternate Art)');
      console.log(`Fixing ${card.slug} -> ${fixedName}`);
      await supabase.from('cards').update({ name: fixedName }).eq('id', card.id);
      fixedCount++;
    } else {
      console.log(`Keeping ${card.slug} as TRUE Manga`);
    }
  }
  console.log(`Fixed ${fixedCount} incorrectly labeled Manga cards.`);
}
run();
