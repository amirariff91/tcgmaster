import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const JP_REGEX = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;

// Hardcoded translations for Japan-only cards not in punk-records English data
const HARDCODED_TRANSLATIONS: Record<string, string> = {
  // Characters
  'カイドウ': 'Kaido',
  'モンキー・D・ルフィ': 'Monkey.D.Luffy',
  'モンキー・Ｄ・ルフィ': 'Monkey.D.Luffy',
  'ボア・ハンコック': 'Boa Hancock',
  '光月モモの助': 'Kozuki Momonosuke',
  'トラファルガー・ロー': 'Trafalgar Law',
  'ユースタス・キッド': 'Eustass Kid',
  'ロロノア・ゾロ': 'Roronoa Zoro',
  'サンジ': 'Sanji',
  'ブルック': 'Brook',
  'ニコ・ロビン': 'Nico Robin',
  'クザン': 'Kuzan',
  'リリス': 'Lilith',
  'ポートガス・D・エース': 'Portgas.D.Ace',
  'カラス': 'Karasu',
  'コアラ': 'Koala',
  'バーソロミュー・くま': 'Bartholomew Kuma',
  'ジンベエ': 'Jinbe',
  'シャーロット・カタクリ': 'Charlotte Katakuri',
  'シャーロット・ブリュレ': 'Charlotte Brulee',
  'シャーロット・クラッカー': 'Charlotte Cracker',
  'シャーロット・リンリン': 'Charlotte Linlin',
  'シャーロット・プリン': 'Charlotte Pudding',
  'ハック': 'Hack',
  'コビー': 'Koby',
  '錦えもん': 'Kineemon',
  'ジュラキュール・ミホーク': 'Dracule Mihawk',
  'シルバーズ・レイリー': 'Silvers Rayleigh',
  'サカズキ': 'Sakazuki',
  'スクラッチメン・アプー': 'Scratchmen Apoo',
  'バルトロメオ': 'Bartolomeo',
  'タマゴ男爵＆ペコムズ': 'Baron Tamago & Pekoms',
  'キラー': 'Killer',
  'ボルサリーノ': 'Borsalino',
  'キャベンディッシュ': 'Cavendish',
  'スモーカー': 'Smoker',
  'リンドバーグ': 'Lindbergh',
  'モンキー・Ｄ・ガープ': 'Monkey.D.Garp',
  'サウザンド・サニー号': 'Thousand Sunny',
  '光月おでん': 'Kouzuki Oden',
  'ジュエリー・ボニー': 'Jewelry Bonney',
  'ウタ': 'Uta',
  'ネフェルタリ・ビビ': 'Nefeltari Vivi',
};

// Cache for punk-records English data: { cardNumber -> englishName }
const englishNameCache: Record<string, string> = {};

// JP pack ID -> EN pack ID mapping (from punk-records)
const PACK_ID_MAP: Record<string, string> = {
  '550001': '569001', '550002': '569002', '550003': '569003', '550004': '569004',
  '550005': '569005', '550006': '569006', '550007': '569007', '550008': '569008',
  '550009': '569009', '550010': '569010', '550011': '569011', '550012': '569012',
  '550013': '569013', '550014': '569014', '550015': '569015', '550016': '569016',
  '550017': '569017', '550018': '569018', '550019': '569019', '550020': '569020',
  '550021': '569021', '550022': '569022', '550023': '569023', '550024': '569024',
  '550025': '569025', '550026': '569026', '550027': '569027', '550028': '569028',
  '550029': '569029', '550030': '569030', '550031': '569031', '550032': '569032',
  '550033': '569033', '550034': '569034', '550035': '569035', '550036': '569036',
  // Booster packs
  '562001': '569101', '562002': '569102', '562003': '569103', '562004': '569104',
  '562005': '569105', '562006': '569106', '562007': '569107', '562008': '569108',
  '562009': '569109', '562010': '569110', '562011': '569111', '562012': '569112',
  '562013': '569113', '562014': '569114', '562015': '569115',
  // Extra boosters
  '567001': '569201', '567002': '569202',
  // PRB
  '565001': '569301',
};

async function loadEnglishNamesForPack(jpPackId: string): Promise<void> {
  const enPackId = PACK_ID_MAP[jpPackId];
  if (!enPackId) return;
  
  try {
    const res = await fetch(`https://raw.githubusercontent.com/buhbbl/punk-records/main/english/data/${enPackId}.json`);
    if (!res.ok) return;
    const cards: any[] = await res.json();
    for (const card of cards) {
      if (card.id && card.name) {
        // Normalize: strip suffix and store base + variant
        const normalizedId = card.id.toUpperCase();
        englishNameCache[normalizedId] = card.name;
      }
    }
  } catch (e) {
    // ignore fetch errors
  }
}

async function loadAllEnglishNames(): Promise<void> {
  console.log("Loading English names from punk-records...");
  
  // Load English packs list
  const packsRes = await fetch('https://raw.githubusercontent.com/buhbbl/punk-records/main/english/packs.json');
  if (!packsRes.ok) return;
  const packs: Record<string, any> = await packsRes.json();
  
  // Load all English card data
  for (const packId of Object.keys(packs)) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/buhbbl/punk-records/main/english/data/${packId}.json`);
      if (!res.ok) continue;
      const cards: any[] = await res.json();
      for (const card of cards) {
        if (card.id && card.name) {
          englishNameCache[card.id.toUpperCase()] = card.name;
        }
      }
    } catch (e) {}
  }
  
  console.log(`Loaded ${Object.keys(englishNameCache).length} English card names into memory.`);
}

async function run() {
  const DRY_RUN = process.argv.includes('--dry-run');
  
  console.log(`Starting Japanese Name Fix Script (${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'})...`);
  
  // Load all English card names from punk-records
  await loadAllEnglishNames();
  
  // Find all Japanese cards with Japanese characters in name
  let page = 0;
  const pageSize = 1000;
  const totalFixed = 0;
  let totalSkipped = 0;
  let hasMore = true;
  
  const fixes: { slug: string; oldName: string; newName: string; id: string }[] = [];
  
  while (hasMore) {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, slug, name, number')
      .ilike('slug', '%-ja')
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (error || !cards || cards.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const card of cards) {
      if (!JP_REGEX.test(card.name || '')) continue;
      
      // Strategy 1: Look up by exact card number (e.g. ST04-005_p2 -> ST04-005_P2)
      const cardNumber = (card.number || '').toUpperCase();
      let newName = englishNameCache[cardNumber];
      
      // Strategy 2: If variant suffix not found, try base number (ST04-005_p2 -> ST04-005)
      if (!newName && cardNumber.includes('_')) {
        const baseNumber = cardNumber.split('_')[0];
        newName = englishNameCache[baseNumber];
      }
      
      // Strategy 3: Look up via slug (strip -ja, strip variant suffix)
      if (!newName) {
        // e.g. op-st04-005_p2-ja -> ST04-005_P2 or ST04-005
        const slugBase = card.slug.replace('-ja', '').replace('op-', '');
        const slugNumber = slugBase.replace(/-/g, '-').toUpperCase();
        newName = englishNameCache[slugNumber];
      }
      
      // Strategy 4: Hardcoded translation table (for promo + newer sets not in punk-records EN)
      if (!newName && HARDCODED_TRANSLATIONS[card.name]) {
        newName = HARDCODED_TRANSLATIONS[card.name];
      }
      
      if (newName) {
        fixes.push({ slug: card.slug, oldName: card.name, newName, id: card.id });
      } else {
        totalSkipped++;
        console.log(`  ⚠️  No English name found for: ${card.slug} (${card.number}) - "${card.name}"`);
      }
    }
    
    page++;
  }
  
  console.log(`\n=== Fix Preview ===`);
  console.log(`Cards to fix: ${fixes.length}`);
  console.log(`Cards with no English equivalent: ${totalSkipped}`);
  
  // Show first 20 fixes as preview
  console.log(`\nSample fixes:`);
  fixes.slice(0, 20).forEach(f => {
    console.log(`  ${f.slug}: "${f.oldName}" → "${f.newName}"`);
  });
  
  if (DRY_RUN) {
    console.log(`\n[DRY RUN] No changes written. Run without --dry-run to apply fixes.`);
    return;
  }
  
  // Apply fixes in batches
  console.log(`\nApplying ${fixes.length} name fixes...`);
  let batchCount = 0;
  for (let i = 0; i < fixes.length; i += 50) {
    const batch = fixes.slice(i, i + 50);
    await Promise.all(batch.map(f =>
      supabase.from('cards').update({ name: f.newName }).eq('id', f.id)
    ));
    batchCount += batch.length;
    process.stdout.write(`\r  Progress: ${batchCount}/${fixes.length}`);
  }
  
  console.log(`\n\n✅ Done! Fixed ${fixes.length} card names. ${totalSkipped} cards had no English equivalent.`);
}

run().catch(console.error);
