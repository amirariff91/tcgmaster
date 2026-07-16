import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function run() {
  console.log("Fixing DBFW set names...");
  
  const { data: dbfwGames } = await supabase.from('games').select('id').eq('slug', 'dbfw');
  const dbfwId = dbfwGames?.[0]?.id;
  if (!dbfwId) {
    console.error("Could not find dbfw game id");
    return;
  }

  const { data: sets } = await supabase.from('sets').select('id, name, slug').eq('game_id', dbfwId);
  if (!sets) return;

  let updatedCount = 0;
  for (const set of sets) {
    // Strip [FB01], 【FB01】 etc.
    let newName = set.name.replace(/\[.*?\]|【.*?】/, '').trim();
    
    // Change "Promotional Cards" to "Promo"
    if (newName === 'Promotional Cards') {
      newName = 'Promo';
    }

    if (newName !== set.name) {
      console.log(`Updating ${set.slug}: "${set.name}" -> "${newName}"`);
      const { error } = await supabase
        .from('sets')
        .update({ name: newName })
        .eq('id', set.id);
        
      if (error) {
        console.error(`Failed to update ${set.slug}:`, error);
      } else {
        updatedCount++;
      }
    }
  }
  
  console.log(`Finished fixing ${updatedCount} DBFW sets.`);
}

run();
