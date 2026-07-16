import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const TRANSLATIONS: Record<string, string> = {
  "OP15-EB04 : BOOSTER PACK": "OP15-EB04",
  "ファミリーデッキセット": "Family Deck Set",
  "限定商品収録カード": "Limited Product Cards",
  "プロモーションカード": "Promotion Cards",
  "ST-31 : 赤 モンキー・D・ルフィ": "ST-31 : Red Monkey.D.Luffy",
  "ST-32 : 緑 ロロノア・ゾロ": "ST-32 : Green Roronoa Zoro",
  "ST-33 : 青 クザン": "ST-33 : Blue Kuzan",
  "ST-34 : 紫 シャーロット・カタクリ": "ST-34 : Purple Charlotte Katakuri",
  "ST-35 : 赤黒 サボ": "ST-35 : Red/Black Sabo",
  "ST-36 : 黄 ユースタス・キッド": "ST-36 : Yellow Eustass Kid",
  "OP-14 : 蒼海の七傑": "OP-14 : The Azure Sea's Seven",
  "OP-15 : 神の島の冒険": "OP-15 : Adventure on God's Island",
};

async function run() {
  const { data: game } = await supabase.from('games').select('id').eq('slug', 'one-piece').single();
  const { data: sets } = await supabase.from('sets').select('id, name, slug').eq('game_id', game!.id);
  
  let updatedCount = 0;
  for (const set of sets!) {
    if (TRANSLATIONS[set.name]) {
      const newName = TRANSLATIONS[set.name];
      await supabase.from('sets').update({ name: newName }).eq('id', set.id);
      console.log(`Updated ${set.slug}: "${set.name}" -> "${newName}"`);
      updatedCount++;
    } else if (set.name.includes("BOOSTER PACK")) {
      const newName = set.name.replace("BOOSTER PACK", "").replace(" : ", "").trim();
      await supabase.from('sets').update({ name: newName }).eq('id', set.id);
      console.log(`Updated ${set.slug}: "${set.name}" -> "${newName}"`);
      updatedCount++;
    }
  }
  
  console.log(`Updated ${updatedCount} sets.`);
}
run();
