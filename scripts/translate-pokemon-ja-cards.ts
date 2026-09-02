import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

// Comprehensive dictionary for all Pokemon TCG characters, trainers, items, and special mechanics
const TCG_TERMS: Record<string, string> = {
  // Supporters, Trainers & Characters
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
  'サカキの切り札': "Giovanni's Last Resort",
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
  'アセロラのいたずら': "Acerola's Mischief",
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
  '詐欺師オーク教授': "Imposter Professor Oak",
  'マサキ': 'Bill',
  'マサキのメンテナンス': "Bill's Maintenance",
  'マサキの転送装置': "Bill's Teleporter",
  'ウツギはかせ': 'Professor Elm',
  'ウツギ博士のレクチャー': "Professor Elm's Lecture",
  'ウツギ博士の育て方': "Professor Elm's Training Method",
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
  'チリ': 'Rika',
  'ピーニャ': 'Giacomo',
  'メリッサ': 'Fantina',
  'メロコ': 'Mela',
  'ピオニー': 'Peony',
  'パラソルおねえさん': 'Parasol Lady',
  'Paldean の学生': 'Paldean Student',
  'ズミ': 'Siebold',
  'アスナ': 'Flannery',
  'タイサイ': 'Choy',
  'スズナ': 'Candice',
  'ヒガナの信頼': "Zinnia's Resolve",
  'ヒガナの決意': "Zinnia's Resolve",
  'ヒガナ': 'Zinnia',
  'ヒカリ': 'Dawn',
  'ネジキ': 'Thorton',
  'カミツレのきらめき': "Elesa's Sparkle",
  'カミツレ': 'Elesa',
  'マスタード いちげきのかた': 'Single Strike Style Mustard',
  'マスタード れんげきのかた': 'Rapid Strike Style Mustard',
  'AZの安らぎ': "AZ's Tranquility",
  'AZ': 'AZ',
  'ギリー': 'Gillie',
  'レッドの挑戦': "Red's Challenge",
  'グリーンの戦略': "Green's Exploration",
  'ビート': 'Bede',
  'ホップ': 'Hop',
  'マリィのプライド': "Marnie's Pride",
  'アオキ': 'Larry',
  'カナリィ': 'Canary',

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
  'エネルギー・リムーブ': 'Energy Removal',
  'エネルギー除去': 'Energy Removal',
  '超エネルギーリムーブ': 'Super Energy Removal',
  'スーパーエネルギー除去2': 'Super Energy Removal 2',
  'スーパーエネルギー除去': 'Super Energy Removal',
  'きずぐすり': 'Potion',
  'いいきずぐすり': 'Super Potion',
  'まんたんのくすり': 'Max Potion',
  'かいふくのくすり': 'Max Potion',
  'なんでもなおし': 'Full Heal',
  'げんきのかけら': 'Revive',
  'げんきのかたまり': 'Max Revive',
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
  'exp。共有': 'Exp. Share',
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
  'ポケモン図鑑': 'Pokédex',
  'ポケモンセンター': 'Pokémon Center',
  'ポケモンの笛': 'Poké Flute',
  'ピッピ人形': 'Clefairy Doll',
  'ポケモン回収': 'Scoop Up',
  'ポケモン交換おじさん': 'Pokémon Trader',
  'ポケモン育て屋さん': 'Pokémon Breeder',
  'メンテナンス': 'Maintenance',
  '退化スプレー': 'Devolution Spray',
  'ジャッジマンホイッスル': 'Judge Whistle',
  'なぞの化石': 'Mysterious Fossil',
  'ポケギア3.0': 'Pokégear 3.0',
  'ゴツゴツメット': 'Rocky Helmet',
  'フィールドブロアー': 'Field Blower',
  'スーパーポケモン回収': 'Super Scoop Up',
  'ミステリートレジャー': 'Mysterious Treasure',
  'エレキパワー': 'Electropower',
  '突風': 'Gust of Wind',
  'プラスパワー': 'PlusPower',
  'ディフェンダー': 'Defender',
  'ワザマシン': 'Technical Machine',
  'ワザマシン エヴォリューション': 'Technical Machine: Evolution',
  'ワザマシン デヴォリューション': 'Technical Machine: Devolution',
  'ワザマシン かじばのいっぱつ': 'Technical Machine: Crisis Punch',
  'ワザマシン ブラインドサイド': 'Technical Machine: Blindside',
  'あなあけスコップ': 'Digging Shovel',
  '鬼の仮面': "Oger's Mask",
  '推理セット': 'Deduction Kit',
  'デンジャラス光線': 'Dangerous Laser',
  'のんびりじゃらし': 'Relaxing Teaser',
  '古びたはねの化石': 'Antique Feather Fossil',
  'ポケモン回収サイクロン': 'Scoop Up Cyclone',
  'むしとりセット': 'Bug Catching Set',
  'むしよけスプレー': 'Repel',
  'サンドウィッチ': 'Sandwich',
  'パワーウエイト': 'Power Weight',
  '冒険': 'Adventure',
  '保護': 'Protection',
  '育て方': 'Training Method',
  'お付き': 'Maids',
  '親切': 'Kindness',
  '香水': 'Perfume',
  'ギャンブル': 'Gamble',
  'クイズ その3': 'Quiz #3',
  '一発勝負': 'Last Stand',
  '奥の手': 'Secret Method',
  'スカウト': 'Scouting',
  'テクニカルマシン01': 'Technical Machine 01',
  'テクニカルマシン02': 'Technical Machine 02',

  // Special Forms, Modifiers & Transliterations
  '未知': 'Unown',
  '同上': 'Ditto',
  '猟犬': 'Houndoom',
  '金星': 'Venusaur',
  '雑草': 'Oddish',
  'おしっこ': 'Pichu',
  '馬': 'Horsea',
  'トレッコ': 'Treecko',
  'グロビル': 'Grovyle',
  'マッドキップ': 'Mudkip',
  'マーシュトンプ': 'Marshtomp',
  'ルディコロ': 'Ludicolo',
  'ルディコロ (Delta Species)': 'Ludicolo (Delta Species)',
  'アエロダクチル': 'Aerodactyl',
  'アエロダクチル (Delta Species)': 'Aerodactyl (Delta Species)',
  'スワロット': 'Swalot',
  'ガルピン': 'Gulpin',
  'カメラプ': 'Camerupt',
  'クラビー': 'Krabby',
  'ロンベル': 'Lombre',
  'カクネア': 'Cacnea',
  'ホース': 'Horsea',
  'ホース (Delta Species)': 'Horsea (Delta Species)',
  'ギャラドススター': 'Gyarados Star',
  'ギャラドススター (Delta Species)': 'Gyarados Star (Delta Species)',
  'セレビの星': 'Celebi Star',
  'ウィンディ': 'Arcanine',
  'マグネトン': 'Magneton',
  'ライチュ': 'Raichu',
  'アンファロス': 'Ampharos',
  'アンファロ': 'Ampharos',
  'マチャンプ': 'Machamp',
  'ラントン': 'Lanturn',
  'ピロスワイン': 'Piloswine',
  'ジェンガー': 'Gengar',
  'スカルモリー': 'Skarmory',
  'スキスター': 'Skarmory',
  'ジョルテオン': 'Jolteon',
  'フラレオン': 'Flareon',
  'バポレオン': 'Vaporeon',
  'エスペオン': 'Espeon',
  'アンブレオン': 'Umbreon',
  'スキプルーム': 'Skiploom',
  'アルカニン': 'Arcanine',
  'デューゴン': 'Dewgong',
  'フラフィ': 'Flaaffy',
  'ノコッチ': 'Dunsparce',
  'ノココッチ': 'Dundunsparce',
  'ムックル': 'Starly',
  'ムクバード': 'Staravia',
  'ムクホーク': 'Staraptor',
  '蝶': 'Butterfree',
  'ジンクス': 'Jynx',
  'ドラゴナイト': 'Dragonite',
  'マンティン': 'Mantine',
  '政治': 'Politoed',
  '爆風': 'Blastoise',
  'ジャンプラフ': 'Jumpluff',
  'ベロッソム': 'Bellossom',
  'オーガポン みどりのめん ex': 'Teal Mask Ogerpon ex',
  'オーガポン かまどのめん ex': 'Hearthflame Mask Ogerpon ex',
  'オーガポン いどのめん ex': 'Wellspring Mask Ogerpon ex',
  'オーガポン いしずえのめん ex': 'Cornerstone Mask Ogerpon ex',
  'ガチグマ アカツキ ex': 'Bloodmoon Ursaluna ex',
  'ガチグマ アカツキ': 'Bloodmoon Ursaluna',
  'ウルトラネクロズマ GX': 'Ultra Necrozma GX',
  'ウルトラネクロズマ': 'Ultra Necrozma',
  'ネクロズマ たそがれのたてがみ GX': 'Dusk Mane Necrozma GX',
  'ネクロズマ あかつきのつばさ GX': 'Dawn Wings Necrozma GX',
  'いちげきウーラオス VMAX': 'Single Strike Urshifu VMAX',
  'いちげきウーラオス V': 'Single Strike Urshifu V',
  'れんげきウーラオス VMAX': 'Rapid Strike Urshifu VMAX',
  'れんげきウーラオス V': 'Rapid Strike Urshifu V',
  'はくばバドレックス VMAX': 'Ice Rider Calyrex VMAX',
  'はくばバドレックス V': 'Ice Rider Calyrex V',
  'こくばバドレックス VMAX': 'Shadow Rider Calyrex VMAX',
  'こくばバドレックス V': 'Shadow Rider Calyrex V',
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

  // Friends & Groups
  'Galarian の仲間たち': 'Friends in Galar',
  'Hisuian の仲間たち': 'Friends in Hisui',
  'Sinnoh の仲間たち': 'Friends in Sinnoh',
  'Paldea の仲間たち': 'Friends in Paldea',
  'Alola の仲間たち': 'Friends in Alola',

  // Stadiums & Gyms
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

// Kana & Character Map
const KANA_MAP: Record<string, string> = {
  'キャ': 'Kya', 'キュ': 'Kyu', 'キョ': 'Kyo',
  'シャ': 'Sha', 'シュ': 'Shu', 'ショ': 'Sho',
  'チャ': 'Cha', 'チュ': 'Chu', 'チョ': 'Cho',
  'ニャ': 'Nya', 'ニュ': 'Nyu', 'ニョ': 'Nyo',
  'ヒャ': 'Hya', 'ヒュ': 'Hyu', 'ヒョ': 'Hyo',
  'ミャ': 'Mya', 'ミュ': 'Myu', 'ミョ': 'Myo',
  'リャ': 'Rya', 'リュ': 'Ryu', 'リョ': 'Ryo',
  'ギャ': 'Gya', 'ギュ': 'Gyu', 'ギョ': 'Gyo',
  'ジャ': 'Ja', 'ジュ': 'Ju', 'ジョ': 'Jo',
  'ビャ': 'Bya', 'ビュ': 'Byu', 'ビョ': 'Byo',
  'ピャ': 'Pya', 'ピュ': 'Pyu', 'ピョ': 'Pyo',
  'ヴァ': 'Va', 'ヴィ': 'Vi', 'ヴェ': 'Ve', 'ヴォ': 'Vo',
  'ティ': 'Ti', 'ディ': 'Di', 'トゥ': 'Tu', 'ドゥ': 'Du',
  'ファ': 'Fa', 'フィ': 'Fi', 'フェ': 'Fe', 'フォ': 'Fo',
  'ア': 'A', 'イ': 'I', 'ウ': 'U', 'エ': 'E', 'オ': 'O',
  'カ': 'Ka', 'キ': 'Ki', 'ク': 'Ku', 'ケ': 'Ke', 'コ': 'Ko',
  'サ': 'Sa', 'シ': 'Shi', 'ス': 'Su', 'セ': 'Se', 'ソ': 'So',
  'タ': 'Ta', 'チ': 'Chi', 'ツ': 'Tsu', 'テ': 'Te', 'ト': 'To',
  'ナ': 'Na', 'ニ': 'Ni', 'ヌ': 'Nu', 'ネ': 'Ne', 'ノ': 'No',
  'ハ': 'Ha', 'ヒ': 'Hi', 'フ': 'Fu', 'ヘ': 'He', 'ホ': 'Ho',
  'マ': 'Ma', 'ミ': 'Mi', 'ム': 'Mu', 'メ': 'Me', 'モ': 'Mo',
  'ヤ': 'Ya', 'ユ': 'Yu', 'ヨ': 'Yo',
  'ラ': 'Ra', 'リ': 'Ri', 'ル': 'Ru', 'レ': 'Re', 'ロ': 'Ro',
  'ワ': 'Wa', 'ヲ': 'Wo', 'ン': 'n',
  'ガ': 'Ga', 'ギ': 'Gi', 'グ': 'Gu', 'ゲ': 'Ge', 'ゴ': 'Go',
  'ザ': 'Za', 'ジ': 'Ji', 'ズ': 'Zu', 'ゼ': 'Ze', 'ゾ': 'Zo',
  'ダ': 'Da', 'ヂ': 'Di', 'ヅ': 'Du', 'デ': 'De', 'ド': 'Do',
  'バ': 'Ba', 'ビ': 'Bi', 'ブ': 'Bu', 'ベ': 'Be', 'ボ': 'Bo',
  'パ': 'Pa', 'ピ': 'Pi', 'プ': 'Pu', 'ペ': 'Pe', 'ポ': 'Po',
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'っ': '', 'ー': '', '・': ' ', '。': '.', '、': ',',
};

function transliterateJapanese(str: string): string {
  let res = str;
  for (const [k, v] of Object.entries(KANA_MAP)) {
    res = res.split(k).join(v);
  }
  // Replace remaining kanji with clean string or title case
  return res.replace(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '').trim();
}

// Prefix Map
const PREFIX_MAP: Record<string, string> = {
  'かがやく': 'Radiant ',
  'わるい': 'Dark ',
  '暗い': 'Dark ',
  'やさしい': 'Light ',
  '軽い': 'Light ',
  'ひかる': 'Shining ',
  'アローラ': 'Alolan ',
  'ガラル': 'Galarian ',
  'ヒスイ': 'Hisuian ',
  'パルデア': 'Paldean ',
  'メガ': 'Mega ',
  'Mega ': 'Mega ',
  'ゲンシ': 'Primal ',
  'アオキの': "Larry's ",
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
  'Arven\'s ': "Arven's ",
  'スグリの': "Kieran's ",
  'ゼイユの': "Carmine's ",
  'アカマツの': "Crispin's ",
  'タロの': "Lacey's ",
  'ネリネの': "Amarys's ",
  'カキツバタの': "Drayton's ",
  'ホイットニーの': "Whitney's ",
  'Whitney\'s ': "Whitney's ",
  'ジャスミンの': "Jasmine's ",
  'Jasmine\'s ': "Jasmine's ",
  'クレアの': "Clair's ",
  'Clair\'s ': "Clair's ",
  'Bugsyの': "Bugsy's ",
  'Bugsy\'s ': "Bugsy's ",
  'ミカンの': "Jasmine's ",
  'アカネの': "Whitney's ",
  'イブキの': "Clair's ",
  'Blaine\'s ': "Blaine's ",
  'Brock\'s ': "Brock's ",
  'Erika\'s ': "Erika's ",
  'Giovanni\'s ': "Giovanni's ",
  'Green\'s ': "Green's ",
  'Ethan\'s ': "Ethan's ",
  'Cynthia\'s ': "Cynthia's ",
  'Misty\'s ': "Misty's ",
  'Sabrina\'s ': "Sabrina's ",
  'Lt. Surge\'s ': "Lt. Surge's ",
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

  return jaToEn;
}

function translateSingleWord(word: string, speciesMap: Map<string, string>): string {
  let trimmed = word.trim();
  if (!trimmed) return '';
  if (TCG_TERMS[trimmed]) return TCG_TERMS[trimmed];
  if (speciesMap.has(trimmed)) return speciesMap.get(trimmed)!;

  let base = trimmed;
  let prefix = '';
  let suffix = '';

  for (const [jaPrefix, enPrefix] of Object.entries(PREFIX_MAP)) {
    if (base.startsWith(jaPrefix)) {
      prefix = enPrefix;
      base = base.slice(jaPrefix.length);
      break;
    }
  }

  for (const { ja, en } of SUFFIX_MAP) {
    if (base.endsWith(ja)) {
      suffix = en;
      base = base.slice(0, -ja.length);
      break;
    }
  }

  base = base.trim();
  base = base.replace(/-\d+\/\d+/g, '').trim();

  if (TCG_TERMS[base]) return `${prefix}${TCG_TERMS[base]}${suffix}`;
  if (speciesMap.has(base)) return `${prefix}${speciesMap.get(base)!}${suffix}`;

  // If still has Japanese characters, transliterate
  if (/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(base)) {
    const transliterated = transliterateJapanese(base);
    if (transliterated.length > 0) {
      return `${prefix}${transliterated}${suffix}`.trim();
    }
  }

  if (prefix || suffix) {
    return `${prefix}${base}${suffix}`.trim();
  }

  return trimmed;
}

function translateCardName(name: string, speciesMap: Map<string, string>): string {
  const trimmed = name.trim();
  if (TCG_TERMS[trimmed]) return TCG_TERMS[trimmed];
  if (speciesMap.has(trimmed)) return speciesMap.get(trimmed)!;

  if (trimmed.includes('&') || trimmed.includes('＆')) {
    const isGx = trimmed.endsWith('GX') || trimmed.endsWith(' GX');
    let clean = trimmed.replace(/\s*GX$/i, '').trim();
    const parts = clean.split(/[&＆]/);
    const translatedParts = parts.map(p => translateSingleWord(p, speciesMap));
    return `${translatedParts.join(' & ')}${isGx ? ' GX' : ''}`;
  }

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

  for (const card of cards) {
    const originalJaName = (card.print_run_info?.ja_name as string) || card.name;
    let englishName = translateCardName(originalJaName, speciesMap);

    // Final safety check: strip any remaining Japanese characters
    if (/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(englishName)) {
      englishName = transliterateJapanese(englishName);
    }
    if (!englishName.trim()) {
      englishName = 'Special Card';
    }

    const updatedPrintRunInfo = {
      ...(card.print_run_info || {}),
      ja_name: originalJaName,
      en_translated: true,
    };

    if (englishName !== card.name || !card.print_run_info?.ja_name) {
      updates.push({
        id: card.id,
        name: englishName.trim(),
        print_run_info: updatedPrintRunInfo,
      });
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
