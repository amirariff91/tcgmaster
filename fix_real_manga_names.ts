import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const REAL_MANGA_SLUGS = [
  'op-op01-120_p2-ja',
  'op-op01-120_r2-ja',
  'op-op02-013_r1-ja',
  'op-op02-013_p2-ja',
  'op-op03-122_r1-ja',
  'op-op03-122_p2-ja',
  'op-op04-083_p2-ja',
  'op-op04-083_r1-ja',
  'op-op05-119_p2-ja',
  'op-op05-119_r2-ja',
  'op-op05-069_r1-ja',
  'op-op05-069_p2-ja',
  'op-op05-074_r2-ja',
  'op-op05-074_p2-ja',
  'op-op06-118_p2-ja',
  'op-op06-118_r1-ja',
  'op-eb01-006_r1-ja',
  'op-eb01-006_p2-ja',
  'op-op07-051_p2-ja',
  'op-op08-118_p2-ja',
  'op-op09-118_p2-ja',
  'op-op09-093_p2-ja',
  'op-op09-004_p2-ja',
  'op-op09-051_p2-ja',
  'op-op09-119_p2-ja',
  'op-op10-119_p2-ja',
  'op-eb02-061_p2-ja',
  'op-op11-118_p2-ja',
  'op-op12-118_p2-ja',
  'op-op06-119_p3-ja',
  'op-op13-119_p1-ja',
  'op-op13-119_p3-ja',
  'op-op13-120_p2-ja',
  'op-op13-120_p3-ja',
  'op-op13-118_p2-ja',
  'op-op13-118_p3-ja',
  'op-op14-119_p2-ja',
  'op-op15-118_p2-ja',
  'op-op16-063_p2-ja',
  'op-op16-065_p2-ja',
  'op-op16-073_p2-ja'
];

async function run() {
  const { data: cards, error } = await supabase.from('cards')
    .select('id, slug, name')
    .in('slug', REAL_MANGA_SLUGS);
    
  if (error) {
    console.error("Error fetching cards:", error);
    return;
  }
    
  let fixedCount = 0;
  for (const card of cards || []) {
    let newName = card.name;
    // Remove existing modifiers
    newName = newName.replace(/\s*\(Manga Alternate Art\)/, '');
    newName = newName.replace(/\s*\(Alternate Art\)/, '');
    
    // Add the correct modifier
    newName = `${newName} (Manga Alternate Art)`;
    
    if (newName !== card.name) {
      console.log(`Updating ${card.slug}: "${card.name}" -> "${newName}"`);
      await supabase.from('cards').update({ name: newName }).eq('id', card.id);
      fixedCount++;
    } else {
      console.log(`Already correct: ${card.slug}`);
    }
  }
  
  const foundSlugs = new Set(cards.map(c => c.slug));
  const missing = REAL_MANGA_SLUGS.filter(s => !foundSlugs.has(s));
  if (missing.length > 0) {
    console.log(`\nWARNING: The following slugs from your list were NOT found in the database:`);
    console.log(missing);
  }
  
  console.log(`\nSuccessfully restored (Manga Alternate Art) label to ${fixedCount} cards!`);
}
run();
