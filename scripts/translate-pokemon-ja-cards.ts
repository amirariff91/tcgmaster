import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

// Comprehensive TCG terms & character dictionary
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
  '博士の研究（フトゥー博士）': "Professor Turo's Scenario",
  '博士の研究（オーリム博士）': "Professor Sada's Vitality",
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
  'ルザミーネ': 'Lusamine',
  'グズマ': 'Guzma',
  'グズマ＆ハラ': 'Guzma & Hala',
  'ネモ': 'Nemona',
  'トウコ': 'Hilda',
  'トウヤ': 'Hilbert',
  'おじょうさま': 'Lady',
  'モノマネむすめ': 'Copycat',
  'アクロマの実験': "Colress's Experiment",
  'アクロマ': 'Colress',
  'スイレンのお世話': "Lana's Aid",
  'スイレン': 'Lana',
  'マオ': 'Mallow',
  'マオ＆スイレン': 'Mallow & Lana',
  'アイリスの闘志': "Iris's Fighting Spirit",
  'アイリス': 'Iris',
  'カエデ': 'Katy',
  'サワロ': 'Saguaro',
  'ジニア': 'Jacq',
  'ポピー': 'Poppy',
  'レホール': 'Raifort',
  'さぎょういん': 'Worker',
  'ザクロ': 'Grant',
  'マーレイン': 'Molayne',
  'ホイットニー': 'Whitney',
  'ジャスミン': 'Jasmine',
  'クレア': 'Clair',
  'ブルーの探索': "Blue's Tact",
  'サカキの計画': "Giovanni's Scheme",
  'サカキのカリスマ': "Giovanni's Charisma",
  'サカキの追放': "Giovanni's Exile",
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
  'ナタネ': 'Gardenia',
  'ウォロ': 'Volo',
  'セキ': 'Adaman',
  'オーキドはかせ': 'Professor Oak',
  'オーキド博士のセッティング': "Professor Oak's Setup",
  'マサキ': 'Bill',
  'マサキのメンテナンス': "Bill's Maintenance",
  'マサキの転送装置': "Bill's Teleporter",
  'ウツギはかせ': 'Professor Elm',
  'ウツギ博士のレクチャー': "Professor Elm's Lecture",
  'ナナミの手助け': "Daisy's Help",
  'シロナ＆カトレア': 'Cynthia & Caitlin',
  'イツキ': 'Will',
  'カリン': 'Karen',
  'キョウ': 'Koga',
  'カツラ': 'Blaine',
  'MCの盛り上げ': 'MC Hype',
  'ジャッジマン': 'Judge',
  'クラッシュハンマー': 'Crushing Hammer',
  '改造ハンマー': 'Enhanced Hammer',
  'とりつかい': 'Bird Keeper',
  'やまおとこ': 'Hiker',
  'たんぱんこぞう': 'Youngster',
  'ミニスカート': 'Lass',
  'ふたごちゃん': 'Twins',
  'ポケモンブリーダー': 'Pokémon Breeder',
  'ポケモンごっこ': 'Poké Kid',

  // Items, ACE SPECs & Tools
  'ポケバイタルA': 'Poké Vital A',
  'アンフェアスタンプ': 'Unfair Stamp',
  'プライムキャッチャー': 'Prime Catcher',
  'カウンターキャッチャー': 'Counter Catcher',
  'カウンターゲイン': 'Counter Gain',
  'マスターボール': 'Master Ball',
  'ネストボール': 'Nest Ball',
  'ハイパーボール': 'Ultra Ball',
  'スーパーボール': 'Great Ball',
  'モンスターボール': 'Poké Ball',
  'クイックボール': 'Quick Ball',
  'レベルボール': 'Level Ball',
  'ヘビーボール': 'Heavy Ball',
  'ヒスイのヘビーボール': 'Hisuian Heavy Ball',
  'フェザーボール': 'Feather Ball',
  'プレシャスボール': 'Precious Ball',
  'ふしぎなアメ': 'Rare Candy',
  '大地の器': 'Earthen Vessel',
  'なかよしポフィン': 'Buddy-Buddy Poffin',
  'すごいつりざお': 'Super Rod',
  'ともだちてちょう': 'Pal Pad',
  '夜のタンカ': 'Night Stretcher',
  '勇気のおまもり': 'Bravery Charm',
  '緊急ボード': 'Emergency Board',
  '森の封印石': 'Forest Seal Stone',
  '空の封印石': 'Sky Seal Stone',
  '大地の封印石': 'Earthen Seal Stone',
  'ロストスイーパー': 'Lost Vacuum',
  'ポケモンいれかえ': 'Switch',
  'あなぬけのヒモ': 'Escape Rope',
  'バトルVIPパス': 'Battle VIP Pass',
  'ダークパッチ': 'Dark Patch',
  'アクアパッチ': 'Aqua Patch',
  'メタルソーサー': 'Metal Saucer',
  'エネルギー転送': 'Energy Search',
  'エネルギー回収': 'Energy Retrieval',
  'スーパーエネルギー回収': 'Superior Energy Retrieval',
  'エネルギーつけかえ': 'Energy Switch',
  'エネルギーリサイクル': 'Energy Recycler',
  'エネルギー増幅器': 'Energy Amplifier',
  'きずぐすり': 'Potion',
  'いいきずぐすり': 'Super Potion',
  'まんたんのくすり': 'Max Potion',
  'かいふくのくすり': 'Max Potion',
  'なんでもなおし': 'Full Heal',
  'ポケモンキャッチャー': 'Pokémon Catcher',
  'カスタムキャッチャー': 'Custom Catcher',
  'グレートキャッチャー': 'Great Catcher',
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
  'きあいのタスキ': 'Focus Sash',
  'ゴージャスマント': 'Gorgeous Cloak',
  'ヒーローマント': 'Hero’s Cape',
  '覚醒のドラム': 'Awakening Drum',
  'リブートポッド': 'Reboot Pod',
  'シークレットボックス': 'Secret Box',
  'プレシャスキャリー': 'Precious Carrier',
  'ミラクルヘッドフォン': 'Miracle Headset',
  'ブレイブバングル': 'Brave Bangle',
  'ふうせん': 'Air Balloon',
  'ロトム図鑑': 'Rotom Pokédex',
  'ジャッジマンホイッスル': 'Judge Whistle',
  'なぞの化石': 'Mysterious Fossil',
  'ポケギア3.0': 'Pokégear 3.0',
  'ゴツゴツメット': 'Rocky Helmet',
  'フィールドブロアー': 'Field Blower',
  'スーパーポケモン回収': 'Super Scoop Up',
  'ミステリートレジャー': 'Mysterious Treasure',
  'エレキパワー': 'Electropower',
  'スーパーエネルギー除去2': 'Super Energy Removal 2',
  'スーパーエネルギー除去': 'Super Energy Removal',
  'エネルギー除去': 'Energy Removal',
  '突風': 'Gust of Wind',
  'プラスパワー': 'PlusPower',
  'ディフェンダー': 'Defender',
  'ワザマシン': 'Technical Machine',
  'ワザマシン エヴォリューション': 'Technical Machine: Evolution',
  'ワザマシン デヴォリューション': 'Technical Machine: Devolution',
  'ワザマシン かじばのいっぱつ': 'Technical Machine: Crisis Punch',
  'ワザマシン ブラインドサイド': 'Technical Machine: Blindside',

  // Special Forms & Modifiers
  'オーガポン みどりのめん ex': 'Teal Mask Ogerpon ex',
  'オーガポン かまどのめん ex': 'Hearthflame Mask Ogerpon ex',
  'オーガポン いどのめん ex': 'Wellspring Mask Ogerpon ex',
  'オーガポン いしずえのめん ex': 'Cornerstone Mask Ogerpon ex',
  'ガチグマ アカツキ ex': 'Bloodmoon Ursaluna ex',
  'ガチグマ アカツキ': 'Bloodmoon Ursaluna',
  'ウルトラネクロズマ GX': 'Ultra Necrozma GX',
  'ウルトラネクロズマ': 'Ultra Necrozma',
  'テラパゴス ex': 'Terapagos ex',
  'モモワロウ ex': 'Pecharunt ex',
  'モモワロウ': 'Pecharunt',
  'スピンロトム': 'Fan Rotom',
  'ヒートロトム': 'Heat Rotom',
  'ウォッシュロトム': 'Wash Rotom',
  'フロストロトム': 'Frost Rotom',
  'カットロトム': 'Mow Rotom',
  'ポリゴン2': 'Porygon2',
  'ポリゴンZ': 'Porygon-Z',
  'アンファロス': 'Ampharos',
  'ライチュ': 'Raichu',
  'マチャンプ': 'Machamp',
  'ラントン': 'Lanturn',
  'ピロスワイン': 'Piloswine',
  'ジェンガー': 'Gengar',
  'スカルモリー': 'Skarmory',
  'スキスター': 'Skarmory',

  // Stadiums
  'トキワシティジム': 'Viridian City Gym',
  'タマムシシティジム': 'Celadon City Gym',
  'ハナダシティジム': 'Cerulean City Gym',
  'ニビシティジム': 'Pewter City Gym',
  'クチバシティジム': 'Vermilion City Gym',
  'ヤマブキシティジム': 'Saffron City Gym',
  'セキチクシティジム': 'Fuchsia City Gym',
  'グレンタウンジム': 'Cinnabar City Gym',
  '無人発電所': 'Power Plant',
  'ポケストップ': 'PokéStop',
  '崩れたスタジアム': 'Collapsed Stadium',
  '頂への雪道': 'Path to the Peak',
  'ボウルタウン': 'Artazon',
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
  'カウンターエネルギー': 'Counter Energy',
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

// Regional & Variant Prefixes
const PREFIX_MAP: Record<string, string> = {
  'かがやく': 'Radiant ',
  'わるい': 'Dark ',
  'やさしい': 'Light ',
  'ひかる': 'Shining ',
  'アローラ': 'Alolan ',
  'ガラル': 'Galarian ',
  'ヒスイ': 'Hisuian ',
  'パルデア': 'Paldean ',
  'メガ': 'Mega ',
  'Mega ': 'Mega ',
  'ゲンシ': 'Primal ',
  'ロケット団の': "Rocket's ",
  'マグマ団の': "Team Magma's ",
  'アクア団の': "Team Aqua's ",
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
  'Lillie\'s ': "Lillie's ",
  'Nの': "N's ",
  'N\'s ': "N's ",
  'Koga\'s ': "Koga's ",
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
  'ホイットニーの': "Whitney's ",
  'ジャスミンの': "Jasmine's ",
  'クレアの': "Clair's ",
  'ミカンの': "Jasmine's ",
  'アカネの': "Whitney's ",
  'イブキの': "Clair's ",
};

// Suffix Map
const SUFFIX_MAP: Array<{ ja: string; en: string }> = [
  { ja: ' (デルタ種)', en: ' (Delta Species)' },
  { ja: '（デルタ種）', en: ' (Delta Species)' },
  { ja: '(デルタ種)', en: ' (Delta Species)' },
  { ja: ' (δ種)', en: ' (Delta Species)' },
  { ja: ' (δ)', en: ' (Delta Species)' },
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

async function loadSpeciesMap(): Promise<Map<string, string>> {
  console.log('[Translate] Loading species CSV from PokeAPI...');
  const csvRes = await fetch(
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv',
  );
  const text = await csvRes.text();
  const lines = text.split('\n');
  const jaToEn = new Map<string, string>();
  const idToNames = new Map<string, { ja?: string; en?: string }>();

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const id = parts[0];
    const lang = parts[1];
    const name = parts[2].trim();

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

  // Extra manual species aliases
  jaToEn.set('ピカチュ', 'Pikachu');
  jaToEn.set('ライチュ', 'Raichu');
  jaToEn.set('アンファロス', 'Ampharos');
  jaToEn.set('マチャンプ', 'Machamp');
  jaToEn.set('ラントン', 'Lanturn');
  jaToEn.set('ピロスワイン', 'Piloswine');
  jaToEn.set('ジェンガー', 'Gengar');
  jaToEn.set('スカルモリー', 'Skarmory');
  jaToEn.set('スキスター', 'Skarmory');
  jaToEn.set('ジョルテオン', 'Jolteon');
  jaToEn.set('フラレオン', 'Flareon');
  jaToEn.set('バポレオン', 'Vaporeon');
  jaToEn.set('エスペオン', 'Espeon');
  jaToEn.set('アンブレオン', 'Umbreon');
  jaToEn.set('リキトゥン', 'Lickitung');
  jaToEn.set('ポリゴン2', 'Porygon2');
  jaToEn.set('ポリゴンZ', 'Porygon-Z');
  jaToEn.set('スキプルーム', 'Skiploom');
  jaToEn.set('アルカニン', 'Arcanine');
  jaToEn.set('ヤミラミ', 'Sableye');
  jaToEn.set('バンギラス', 'Tyranitar');
  jaToEn.set('メルメタル', 'Melmetal');
  jaToEn.set('ルカリオ', 'Lucario');
  jaToEn.set('レシラム', 'Reshiram');
  jaToEn.set('ゼクロム', 'Zekrom');
  jaToEn.set('ゲッコウガ', 'Greninja');
  jaToEn.set('ゾロアーク', 'Zoroark');
  jaToEn.set('ガブリアス', 'Garchomp');
  jaToEn.set('ギラティナ', 'Giratina');
  jaToEn.set('ファイヤー', 'Moltres');
  jaToEn.set('サンダー', 'Zapdos');
  jaToEn.set('フリーザー', 'Articuno');
  jaToEn.set('ココドラ', 'Aron');
  jaToEn.set('コドラ', 'Lairon');
  jaToEn.set('ボスゴドラ', 'Aggron');

  return jaToEn;
}

function translateSingleWord(word: string, speciesMap: Map<string, string>): string {
  const trimmed = word.trim();
  if (!trimmed) return '';
  if (TCG_TERMS[trimmed]) return TCG_TERMS[trimmed];
  if (speciesMap.has(trimmed)) return speciesMap.get(trimmed)!;

  let base = trimmed;
  let prefix = '';
  let suffix = '';

  // Form or Owner prefix
  for (const [jaPrefix, enPrefix] of Object.entries(PREFIX_MAP)) {
    if (base.startsWith(jaPrefix)) {
      prefix = enPrefix;
      base = base.slice(jaPrefix.length);
      break;
    }
  }

  // Suffix
  for (const { ja, en } of SUFFIX_MAP) {
    if (base.endsWith(ja)) {
      suffix = en;
      base = base.slice(0, -ja.length);
      break;
    }
  }

  base = base.trim();

  // Strip set number suffixes e.g. "-016/092"
  base = base.replace(/-\d+\/\d+/g, '').trim();

  if (TCG_TERMS[base]) return `${prefix}${TCG_TERMS[base]}${suffix}`;
  if (speciesMap.has(base)) return `${prefix}${speciesMap.get(base)!}${suffix}`;

  if (prefix || suffix) {
    // If base still has unmapped text, try to clean
    return `${prefix}${base}${suffix}`;
  }

  return trimmed;
}

function translateCardName(name: string, speciesMap: Map<string, string>): string {
  const trimmed = name.trim();
  if (TCG_TERMS[trimmed]) return TCG_TERMS[trimmed];
  if (speciesMap.has(trimmed)) return speciesMap.get(trimmed)!;

  // Handle Tag Teams e.g. "レシラム&リザードン GX" or "ファイヤー&サンダー&フリーザー GX"
  if (trimmed.includes('&') || trimmed.includes('＆')) {
    const isGx = trimmed.endsWith('GX') || trimmed.endsWith(' GX');
    let clean = trimmed.replace(/\s*GX$/i, '').trim();
    const parts = clean.split(/[&＆]/);
    const translatedParts = parts.map(p => translateSingleWord(p, speciesMap));
    return `${translatedParts.join(' & ')}${isGx ? ' GX' : ''}`;
  }

  // Handle owner e.g. "Lillie's 決心" -> "Lillie's Full Force"
  if (trimmed.startsWith("Lillie's ") || trimmed.startsWith('リーリエの')) {
    const rest = trimmed.replace(/^(Lillie's |リーリエの)/, '').trim();
    if (rest === '決心' || rest === '全力') return "Lillie's Full Force";
    if (rest === 'ピッピ') return "Lillie's Clefairy";
    return `Lillie's ${translateSingleWord(rest, speciesMap)}`;
  }

  if (trimmed.startsWith("N's ") || trimmed.startsWith('Nの')) {
    const rest = trimmed.replace(/^(N's |Nの)/, '').trim();
    if (rest === 'ポイントアップ' || rest === 'PP Up') return "N's PP Up";
    if (rest === '覚悟' || rest === 'レジリエンス') return "N's Resolve";
    if (rest === 'ゾロアーク') return "N's Zoroark";
    if (rest === 'レシラム') return "N's Reshiram";
    if (rest === 'ゼクロム') return "N's Zekrom";
    return `N's ${translateSingleWord(rest, speciesMap)}`;
  }

  // Handle standard word
  return translateSingleWord(trimmed, speciesMap);
}

async function run() {
  console.log('[Translate JA Cards] Loading dictionaries...');
  const speciesMap = await loadSpeciesMap();

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

  console.log(`[Translate JA Cards] Processing ${cards.length} cards...`);

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
      translatedCount++;
    }
  }

  console.log(`[Translate JA Cards] Executing ${updates.length} updates...`);

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
  }

  console.log(`[Translate JA Cards] Finished translating cards!`);

  // Flush search cache
  await redis.del('api:search:trending');
  const searchKeys = await redis.keys('search:*');
  for (const k of searchKeys) await redis.del(k);
  console.log(`[Translate JA Cards] Flushed Redis caches.`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
