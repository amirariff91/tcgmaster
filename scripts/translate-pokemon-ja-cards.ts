import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

// Common Trainers, Supporters, Items, Stadiums, and Energy Dictionary
const TCG_TERMS: Record<string, string> = {
  // Supporters & Characters
  'ナンジャモ': 'Iono',
  'リーリエ': 'Lillie',
  'マリィ': 'Marnie',
  'エリカのおもてなし': "Erika's Hospitality",
  'エリカの招待': "Erika's Invitation",
  'エリカ': 'Erika',
  'カイ': 'Irida',
  'セレナ': 'Serena',
  'カトレア': 'Caitlin',
  'フウロ': 'Skyla',
  'コルニの気合い': "Korrina's Focus",
  'コルニ': 'Korrina',
  'シロナ': 'Cynthia',
  'シロナの覇気': "Cynthia's Ambition",
  'ボスの指令': "Boss's Orders",
  '博士の研究': "Professor's Research",
  'ペパー': 'Arven',
  'ボタン': 'Penny',
  'ミモザ': 'Miriam',
  'キハダ': 'Dendra',
  'グルーシャ': 'Grusha',
  'ゼイユ': 'Carmine',
  'スグリ': 'Kieran',
  'タロ': 'Lacey',
  'ブライア': 'Briar',
  'アカマツ': 'Crispin',
  'カキツバタ': 'Drayton',
  'ネリネ': 'Amarys',
  'サカキの計画': "Giovanni's Scheme",
  'サカキのカリスマ': "Giovanni's Charisma",
  'サカキ': 'Giovanni',
  'カスミのお願い': "Misty's Favor",
  'カスミのやる気': "Misty's Determination",
  'カスミのなみだ': "Misty's Tears",
  'カスミ': 'Misty',
  'タケシのガッツ': "Brock's Grit",
  'タケシ': 'Brock',
  'ナツメの暗示': "Sabrina's Suggestion",
  'ナツメ': 'Sabrina',
  'マチスの作戦': "Lt. Surge's Strategy",
  'マチス': 'Lt. Surge',
  'アセロラ': 'Acerola',
  'アセロラの予感': "Acerola's Premonition",
  'ルチア': 'Lisia',
  'ルチアのアピール': "Lisia's Appeal",
  'かんこうきゃく': 'Sightseer',
  'メイ': 'Rosa',
  'クララ': 'Klara',
  'セイボリー': 'Avery',
  'ユウリ': 'Gloria',
  'サイトウ': 'Bea',
  'オニオン': 'Allister',
  'ルリナ': 'Nessa',
  'ダンデ': 'Leon',
  'キバナ': 'Raihan',
  'カブ': 'Kabu',
  'ヤロー': 'Milo',
  'ソニア': 'Sonia',
  'メロン': 'Melony',
  'ツツジ': 'Roxanne',
  'ナタネの活気': "Gardenia's Vigor",
  'ウォロ': 'Volo',
  'セキ': 'Adaman',
  'オーキドはかせ': 'Professor Oak',
  'オーキド博士のセッティング': "Professor Oak's Setup",
  'マサキ': 'Bill',
  'ウツギはかせ': 'Professor Elm',
  'ナナミの手助け': "Daisy's Help",
  'スイレン': 'Lana',
  'マオ': 'Mallow',
  'マオ＆スイレン': 'Mallow & Lana',
  'シロナ＆カトレア': 'Cynthia & Caitlin',
  'グズマ＆ハラ': 'Guzma & Hala',
  'イツキ': 'Will',
  'カリン': 'Karen',
  'キョウ': 'Koga',
  'カツラ': 'Blaine',
  'MCの盛り上げ': 'MC Hype',
  'ジャッジマン': 'Judge',
  'クラッシュハンマー': 'Crushing Hammer',
  'とりつかい': 'Bird Keeper',

  // Items & Tools
  'ネストボール': 'Nest Ball',
  'ハイパーボール': 'Ultra Ball',
  'スーパーボール': 'Great Ball',
  'モンスターボール': 'Poké Ball',
  'マスターボール': 'Master Ball',
  'クイックボール': 'Quick Ball',
  'レベルボール': 'Level Ball',
  'ヘビーボール': 'Heavy Ball',
  'ヒスイのヘビーボール': 'Hisuian Heavy Ball',
  'フェザーボール': 'Feather Ball',
  'ふしぎなアメ': 'Rare Candy',
  '大地の器': 'Earthen Vessel',
  'なかよしポフィン': 'Buddy-Buddy Poffin',
  'プライムキャッチャー': 'Prime Catcher',
  'カウンターキャッチャー': 'Counter Catcher',
  'すごいつりざお': 'Super Rod',
  'ともだちてちょう': 'Pal Pad',
  '夜のタンカ': 'Night Stretcher',
  '勇気のおまもり': 'Bravery Charm',
  '緊急ボード': 'Emergency Board',
  '森の封印石': 'Forest Seal Stone',
  '空の封印石': 'Sky Seal Stone',
  'ロストスイーパー': 'Lost Vacuum',
  'ポケモンいれかえ': 'Switch',
  'あなぬけのヒモ': 'Escape Rope',
  'バトルVIPパス': 'Battle VIP Pass',
  'ダークパッチ': 'Dark Patch',
  'エネルギー転送': 'Energy Search',
  'エネルギー回収': 'Energy Retrieval',
  'スーパーエネルギー回収': 'Superior Energy Retrieval',
  'エネルギーつけかえ': 'Energy Switch',
  'きずぐすり': 'Potion',
  'いいきずぐすり': 'Super Potion',
  'まんたんのくすり': 'Max Potion',
  'なんでもなおし': 'Full Heal',
  'ポケモンキャッチャー': 'Pokémon Catcher',
  'ポケモン通信': 'Pokémon Communication',
  'パソコン通信': 'Computer Search',
  'ダウジングマシーン': 'Dowsing Machine',
  'タウンマップ': 'Town Map',
  'レスキュータンカ': 'Rescue Stretcher',
  'レスキューキャリー': 'Rescue Carrier',
  'こだわりベルト': 'Choice Belt',
  'こだわりハチマキ': 'Choice Band',
  'かるいし': 'Float Stone',
  'タフネスマント': 'Cape of Toughness',
  '大きなおまもり': 'Big Charm',
  '学習装置': 'Exp. Share',
  'げんきのハチマキ': 'Muscle Band',
  'ちからのハチマキ': 'Power Band',
  'きあいのハチマキ': 'Focus Band',
  'ゴージャスマント': 'Gorgeous Cloak',
  'ヒーローマント': 'Hero’s Cape',
  '覚醒のドラム': 'Awakening Drum',
  'リブートポッド': 'Reboot Pod',
  'アンフェアスタンプ': 'Unfair Stamp',
  'シークレットボックス': 'Secret Box',
  'プレシャスキャリー': 'Precious Carrier',
  'ミラクルヘッドフォン': 'Miracle Headset',

  // Stadiums
  'ポケストップ': 'PokéStop',
  '崩れたスタジアム': 'Collapsed Stadium',
  '頂への雪道': 'Path to the Peak',
  'ボウルタウン': 'Mesagoza',
  'テーブルシティ': 'Mesagoza',
  'ビーチコート': 'Beach Court',
  'タウンデパート': 'Town Store',
  'ジャミングタワー': 'Jamming Tower',
  'ニュートラルセンター': 'Neutral Center',
  '大空洞のパゴダ': 'Area Zero Underdepths',
  'ゼロの大空洞': 'Area Zero Underdepths',
  'シンオウ神殿': 'Temple of Sinnoh',
  'トレーニングコート': 'Training Court',
  '混沌のうねり': 'Chaotic Swell',
  'トキワの森': 'Viridian Forest',
  'せせらぎの丘': 'Brooklet Hill',

  // Energy
  '基本草エネルギー': 'Basic Grass Energy',
  '基本炎エネルギー': 'Basic Fire Energy',
  '基本水エネルギー': 'Basic Water Energy',
  '基本雷エネルギー': 'Basic Lightning Energy',
  '基本超エネルギー': 'Basic Psychic Energy',
  '基本闘エネルギー': 'Basic Fighting Energy',
  '基本悪エネルギー': 'Basic Darkness Energy',
  '基本鋼エネルギー': 'Basic Metal Energy',
  '草エネルギー': 'Grass Energy',
  '炎エネルギー': 'Fire Energy',
  '水エネルギー': 'Water Energy',
  '雷エネルギー': 'Lightning Energy',
  '超エネルギー': 'Psychic Energy',
  '闘エネルギー': 'Fighting Energy',
  '悪エネルギー': 'Darkness Energy',
  '鋼エネルギー': 'Metal Energy',
  '無色エネルギー': 'Colorless Energy',
  'ダブル無色エネルギー': 'Double Colorless Energy',
  'ダブルターボエネルギー': 'Double Turbo Energy',
  'ジェットエネルギー': 'Jet Energy',
  'ルミナスエネルギー': 'Luminous Energy',
  'リバーサルエネルギー': 'Reversal Energy',
  'ミストエネルギー': 'Mist Energy',
  'レガシーエネルギー': 'Legacy Energy',
  'ネオアッパーエネルギー': 'Neo Upper Energy',
  'ツインエネルギー': 'Twin Energy',
  'トリプル加速エネルギー': 'Triple Acceleration Energy',
  'オーロラエネルギー': 'Aurora Energy',
  'レインボーエネルギー': 'Rainbow Energy',
  'キャプチャーエネルギー': 'Capture Energy',
  'スピード雷エネルギー': 'Speed Lightning Energy',
  'ホラー超エネルギー': 'Horror Psychic Energy',
};

// Owner prefix mappings
const OWNER_PREFIXES: Record<string, string> = {
  'ロケット団の': "Rocket's ",
  'シロナの': "Cynthia's ",
  'カスミの': "Misty's ",
  'タケシの': "Brock's ",
  'マチスの': "Lt. Surge's ",
  'エリカの': "Erika's ",
  'ナツメの': "Sabrina's ",
  'カツラの': "Blaine's ",
  'サカキの': "Giovanni's ",
  'キョウの': "Koga's ",
  'カリンの': "Karen's ",
  'ワタルの': "Lance's ",
  'ダイゴの': "Steven's ",
  'ヒビキの': "Ethan's ",
  'コトネの': "Lyra's ",
  'レッドの': "Red's ",
  'グリーンの': "Green's ",
  'リーリエの': "Lillie's ",
  'Nの': "N's ",
  'マリィの': "Marnie's ",
  'ダンデの': "Leon's ",
  'キバナの': "Raihan's ",
  'ホップの': "Hop's ",
  'クララの': "Klara's ",
  'セイボリーの': "Avery's ",
  'セレナの': "Serena's ",
  'ユウリの': "Gloria's ",
  'ナンジャモの': "Iono's ",
  'ボタンの': "Penny's ",
  'ペパーの': "Arven's ",
  'スグリの': "Kieran's ",
  'ゼイユの': "Carmine's ",
  'アカマツの': "Crispin's ",
  'タロの': "Lacey's ",
  'ネリネの': "Amarys's ",
  'カキツバタの': "Drayton's ",
};

// Form prefixes
const FORM_PREFIXES: Record<string, string> = {
  'かがやく': 'Radiant ',
  'わるい': 'Dark ',
  'やさしい': 'Light ',
  'ひかる': 'Shining ',
  'アローラ': 'Alolan ',
  'ガラル': 'Galarian ',
  'ヒスイ': 'Hisuian ',
  'パルデア': 'Paldean ',
  'メガ': 'Mega ',
  'ゲンシ': 'Primal ',
};

// Suffixes
const SUFFIXES: Array<{ ja: string; en: string }> = [
  { ja: 'V-UNION', en: ' V-UNION' },
  { ja: 'VMAX', en: ' VMAX' },
  { ja: 'VSTAR', en: ' VSTAR' },
  { ja: 'TAG TEAM', en: ' TAG TEAM' },
  { ja: 'BREAK', en: ' BREAK' },
  { ja: 'LV.X', en: ' LV.X' },
  { ja: 'LEGEND', en: ' LEGEND' },
  { ja: 'ex', en: ' ex' },
  { ja: 'EX', en: ' EX' },
  { ja: 'GX', en: ' GX' },
  { ja: 'V', en: ' V' },
  { ja: '◇', en: ' Prism Star' },
  { ja: 'δ', en: ' Delta Species' },
  { ja: 'FB', en: ' FB' },
  { ja: 'GL', en: ' GL' },
  { ja: 'C', en: ' C' },
  { ja: 'G', en: ' G' },
  { ja: 'SP', en: ' SP' },
];

async function loadPokemonSpeciesMap(): Promise<Map<string, string>> {
  console.log('[Translate] Fetching official Pokemon species dictionary from PokeAPI...');
  const csvRes = await fetch(
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv',
  );
  if (!csvRes.ok) {
    throw new Error(`Failed to fetch species CSV: ${csvRes.statusText}`);
  }
  const text = await csvRes.text();
  const lines = text.split('\n');
  const jaToEn = new Map<string, string>();
  const idToNames = new Map<string, { ja?: string; en?: string }>();

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const id = parts[0];
    const lang = parts[1];
    const name = parts[2];

    if (!idToNames.has(id)) idToNames.set(id, {});
    const entry = idToNames.get(id)!;
    if (lang === '1' || lang === '11') entry.ja = name;
    if (lang === '9') entry.en = name;
  }

  for (const [_, names] of idToNames.entries()) {
    if (names.ja && names.en) {
      jaToEn.set(names.ja, names.en);
    }
  }

  console.log(`[Translate] Loaded ${jaToEn.size} official Pokemon species translations.`);
  return jaToEn;
}

function translateCardName(jaName: string, speciesMap: Map<string, string>): string {
  const trimmed = jaName.trim();

  // 1. Direct TCG term match (Trainer/Item/Energy)
  if (TCG_TERMS[trimmed]) {
    return TCG_TERMS[trimmed];
  }

  // 2. Direct species match
  if (speciesMap.has(trimmed)) {
    return speciesMap.get(trimmed)!;
  }

  let base = trimmed;
  let prefix = '';
  let suffix = '';

  // Check form prefixes
  for (const [jaPrefix, enPrefix] of Object.entries(FORM_PREFIXES)) {
    if (base.startsWith(jaPrefix)) {
      prefix = enPrefix;
      base = base.slice(jaPrefix.length);
      break;
    }
  }

  // Check owner prefixes
  if (!prefix) {
    for (const [jaOwner, enOwner] of Object.entries(OWNER_PREFIXES)) {
      if (base.startsWith(jaOwner)) {
        prefix = enOwner;
        base = base.slice(jaOwner.length);
        break;
      }
    }
  }

  // Check suffixes
  for (const { ja, en } of SUFFIXES) {
    if (base.endsWith(ja)) {
      suffix = en;
      base = base.slice(0, -ja.length);
      break;
    }
  }

  // Clean base
  base = base.trim();

  // Check if base is a known Pokemon species
  if (speciesMap.has(base)) {
    return `${prefix}${speciesMap.get(base)!}${suffix}`;
  }

  // Check if base is a known TCG term
  if (TCG_TERMS[base]) {
    return `${prefix}${TCG_TERMS[base]}${suffix}`;
  }

  // Return formatted name if suffix/prefix applied
  if (prefix || suffix) {
    return `${prefix}${base}${suffix}`;
  }

  return trimmed;
}

async function run() {
  console.log('[Pokemon JA Card Translate] Starting translation of Japanese Pokemon card names...');

  const speciesMap = await loadPokemonSpeciesMap();

  // Fetch all Japanese cards
  const cards = await dbQuery<{
    id: string;
    name: string;
    print_run_info: Record<string, unknown> | null;
  }>(`
    SELECT c.id, c.name, c.print_run_info
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug LIKE 'pokemon-%-ja'
  `);

  console.log(`[Pokemon JA Card Translate] Found ${cards.length} Japanese cards in database.`);

  const updates: Array<{ id: string; name: string; print_run_info: Record<string, unknown> }> = [];
  let translatedCount = 0;

  for (const card of cards) {
    const originalJaName = (card.print_run_info?.ja_name as string) || card.name;
    const englishName = translateCardName(originalJaName, speciesMap);

    const updatedPrintRunInfo = {
      ...(card.print_run_info || {}),
      ja_name: originalJaName,
      en_translated: true,
    };

    if (englishName !== card.name || !card.print_run_info?.ja_name) {
      updates.push({
        id: card.id,
        name: englishName,
        print_run_info: updatedPrintRunInfo,
      });
      if (englishName !== originalJaName) {
        translatedCount++;
      }
    }
  }

  console.log(`[Pokemon JA Card Translate] Prepared ${updates.length} updates (${translatedCount} translated to English).`);

  // Batch update in chunks of 500
  const batchSize = 500;
  for (let i = 0; i < updates.length; i += batchSize) {
    const chunk = updates.slice(i, i + batchSize);
    await dbQuery(`
      UPDATE cards AS c
      SET name = v.name,
          print_run_info = v.print_run_info
      FROM (
        SELECT (x->>'id')::uuid AS id, x->>'name' AS name, (x->'print_run_info')::jsonb AS print_run_info
        FROM jsonb_array_elements($1::jsonb) AS x
      ) AS v
      WHERE c.id = v.id
    `, [JSON.stringify(chunk)]);

    console.log(`[Pokemon JA Card Translate] Updated ${Math.min(i + batchSize, updates.length)} / ${updates.length} cards...`);
  }

  console.log(`\n========================================`);
  console.log(`[Pokemon JA Card Translate] Successfully Translated Japanese Cards!`);
  console.log(`Total Cards Updated: ${updates.length}`);
  console.log(`========================================\n`);

  // Flush Redis caches
  const cacheKeys = [
    'api:search:trending',
    'api:sets:pokemon',
    'api:sets:pokemon:ja',
    'api:games:all',
  ];
  for (const key of cacheKeys) {
    await redis.del(key);
  }
  console.log('[Pokemon JA Card Translate] Flushed Redis search caches.');
}

run()
  .catch((err) => {
    console.error('[Pokemon JA Card Translate] Fatal Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
