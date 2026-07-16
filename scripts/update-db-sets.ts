import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Service role key
const supabase = createClient(supabaseUrl!, supabaseKey!);

function formatSetName(rawTitle: string): string {
  const match = rawTitle.match(/\[(.*?)\]|【(.*?)】/);
  const code = match ? (match[1] || match[2]) : null;
  if (!code) return rawTitle;
  
  let name = rawTitle.replace(/\[.*?\]|【.*?】/, '').trim();
  name = name.replace(/^(BOOSTER PACK|EXTRA BOOSTER|PREMIUM BOOSTER|STARTER DECK(?: EX)?|ULTRA DECK)\s*-?/i, '');
  name = name.replace(/^(ブースターパック|エクストラブースター|プレミアムブースター|スタートデッキ|アルティメットデッキ)\s*/, '');
  name = name.replace(/^-+|-+$/g, '').trim();
  
  if (!name) {
     name = rawTitle.replace(/\[.*?\]|【.*?】/, '').trim();
  }
  
  return `${code} : ${name}`;
}

async function run() {
  const { data: game } = await supabase.from('games').select('id').eq('slug', 'one-piece').single();
  const { data: sets } = await supabase.from('sets').select('id, name, slug').eq('game_id', game!.id);
  
  let updatedCount = 0;
  for (const set of sets!) {
    const newName = formatSetName(set.name);
    if (newName !== set.name) {
      await supabase.from('sets').update({ name: newName }).eq('id', set.id);
      console.log(`Updated ${set.slug}: "${set.name}" -> "${newName}"`);
      updatedCount++;
    }
  }
  
  console.log(`Updated ${updatedCount} sets.`);
}
run();
