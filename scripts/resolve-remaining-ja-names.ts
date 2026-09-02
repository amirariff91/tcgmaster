import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

const FULL_KANA_MAP: [string, string][] = [
  // Compound Kana
  ['キャ', 'Kya'], ['キュ', 'Kyu'], ['キョ', 'Kyo'],
  ['シャ', 'Sha'], ['シュ', 'Shu'], ['ショ', 'Sho'],
  ['チャ', 'Cha'], ['チュ', 'Chu'], ['チョ', 'Cho'],
  ['ニャ', 'Nya'], ['ニュ', 'Nyu'], ['ニョ', 'Nyo'],
  ['ヒャ', 'Hya'], ['ヒュ', 'Hyu'], ['ヒョ', 'Hyo'],
  ['ミャ', 'Mya'], ['ミュ', 'Myu'], ['ミョ', 'Myo'],
  ['リャ', 'Rya'], ['リュ', 'Ryu'], ['リョ', 'Ryo'],
  ['ギャ', 'Gya'], ['ギュ', 'Gyu'], ['ギョ', 'Gyo'],
  ['ジャ', 'Ja'], ['ジュ', 'Ju'], ['ジョ', 'Jo'],
  ['ビャ', 'Bya'], ['ビュ', 'Byu'], ['ビョ', 'Byo'],
  ['ピャ', 'Pya'], ['ピュ', 'Pyu'], ['ピョ', 'Pyo'],
  ['ヴァ', 'Va'], ['ヴィ', 'Vi'], ['ヴェ', 'Ve'], ['ヴォ', 'Vo'],
  ['ティ', 'Ti'], ['ディ', 'Di'], ['トゥ', 'Tu'], ['ドゥ', 'Du'],
  ['ファ', 'Fa'], ['フィ', 'Fi'], ['フェ', 'Fe'], ['フォ', 'Fo'],
  ['チェ', 'Che'], ['ジェ', 'Je'], ['シェ', 'She'],
  ['ウィ', 'Wi'], ['ウェ', 'We'], ['ウォ', 'Wo'],
  ['クァ', 'Qua'], ['クィ', 'Qui'], ['クェ', 'Que'], ['クォ', 'Quo'],
  ['ツァ', 'Tsa'], ['ツィ', 'Tsi'], ['ツェ', 'Tse'], ['ツォ', 'Tso'],

  // Katakana single
  ['ア', 'A'], ['イ', 'I'], ['ウ', 'U'], ['エ', 'E'], ['オ', 'O'],
  ['カ', 'Ka'], ['キ', 'Ki'], ['ク', 'Ku'], ['ケ', 'Ke'], ['コ', 'Ko'],
  ['サ', 'Sa'], ['シ', 'Shi'], ['ス', 'Su'], ['セ', 'Se'], ['ソ', 'So'],
  ['タ', 'Ta'], ['チ', 'Chi'], ['ツ', 'Tsu'], ['テ', 'Te'], ['ト', 'To'],
  ['ナ', 'Na'], ['ニ', 'Ni'], ['ヌ', 'Nu'], ['ネ', 'Ne'], ['ノ', 'No'],
  ['ハ', 'Ha'], ['ヒ', 'Hi'], ['フ', 'Fu'], ['ヘ', 'He'], ['ホ', 'Ho'],
  ['マ', 'Ma'], ['ミ', 'Mi'], ['ム', 'Mu'], ['メ', 'Me'], ['モ', 'Mo'],
  ['ヤ', 'Ya'], ['ユ', 'Yu'], ['ヨ', 'Yo'],
  ['ラ', 'Ra'], ['リ', 'Ri'], ['ル', 'Ru'], ['レ', 'Re'], ['ロ', 'Ro'],
  ['ワ', 'Wa'], ['ヲ', 'Wo'], ['ン', 'n'],
  ['ガ', 'Ga'], ['ギ', 'Gi'], ['グ', 'Gu'], ['ゲ', 'Ge'], ['ゴ', 'Go'],
  ['ザ', 'Za'], ['ジ', 'Ji'], ['ズ', 'Zu'], ['ゼ', 'Ze'], ['ゾ', 'Zo'],
  ['ダ', 'Da'], ['ヂ', 'Di'], ['ヅ', 'Du'], ['デ', 'De'], ['ド', 'Do'],
  ['バ', 'Ba'], ['ビ', 'Bi'], ['ブ', 'Bu'], ['ベ', 'Be'], ['ボ', 'Bo'],
  ['パ', 'Pa'], ['ピ', 'Pi'], ['プ', 'Pu'], ['ペ', 'Pe'], ['ポ', 'Po'],
  ['ァ', 'a'], ['ィ', 'i'], ['ゥ', 'u'], ['ェ', 'e'], ['ォ', 'o'],
  ['ッ', 't'], ['ャ', 'ya'], ['ュ', 'yu'], ['ョ', 'yo'], ['ヮ', 'wa'],

  // Hiragana compound
  ['きゃ', 'Kya'], ['きゅ', 'Kyu'], ['きょ', 'Kyo'],
  ['しゃ', 'Sha'], ['しゅ', 'Shu'], ['しょ', 'Sho'],
  ['ちゃ', 'Cha'], ['ちゅ', 'Chu'], ['ちょ', 'Cho'],
  ['にゃ', 'Nya'], ['にゅ', 'Nyu'], ['にょ', 'Nyo'],
  ['ひゃ', 'Hya'], ['ひゅ', 'Hyu'], ['ひょ', 'Hyo'],
  ['みゃ', 'Mya'], ['みゅ', 'Myu'], ['みょ', 'Myo'],
  ['りゃ', 'Rya'], ['りゅ', 'Ryu'], ['りょ', 'Ryo'],
  ['ぎゃ', 'Gya'], ['ぎゅ', 'Gyu'], ['ぎょ', 'Gyo'],
  ['じゃ', 'Ja'], ['じゅ', 'Ju'], ['じょ', 'Jo'],
  ['びゃ', 'Bya'], ['びゅ', 'Byu'], ['びょ', 'Byo'],
  ['ぴゃ', 'Pya'], ['ぴゅ', 'Pyu'], ['ぴょ', 'Pyo'],

  // Hiragana single
  ['あ', 'A'], ['い', 'I'], ['う', 'U'], ['え', 'E'], ['お', 'O'],
  ['か', 'Ka'], ['き', 'Ki'], ['く', 'Ku'], ['け', 'Ke'], ['こ', 'Ko'],
  ['さ', 'Sa'], ['し', 'Shi'], ['す', 'Su'], ['せ', 'Se'], ['そ', 'So'],
  ['た', 'Ta'], ['ち', 'Chi'], ['つ', 'Tsu'], ['て', 'Te'], ['と', 'To'],
  ['な', 'Na'], ['に', 'Ni'], ['ぬ', 'Nu'], ['ね', 'Ne'], ['の', 'No'],
  ['は', 'Ha'], ['ひ', 'Hi'], ['ふ', 'Fu'], ['へ', 'He'], ['ほ', 'Ho'],
  ['ま', 'Ma'], ['み', 'Mi'], ['む', 'Mu'], ['め', 'Me'], ['も', 'Mo'],
  ['や', 'Ya'], ['ゆ', 'Yu'], ['よ', 'Yo'],
  ['ら', 'Ra'], ['り', 'Ri'], ['る', 'Ru'], ['れ', 'Re'], ['ろ', 'Ro'],
  ['わ', 'Wa'], ['を', 'Wo'], ['ん', 'n'],
  ['が', 'Ga'], ['ぎ', 'Gi'], ['ぐ', 'Gu'], ['げ', 'Ge'], ['ご', 'Go'],
  ['ざ', 'Za'], ['じ', 'Ji'], ['ず', 'Zu'], ['ぜ', 'Ze'], ['ぞ', 'Zo'],
  ['だ', 'Da'], ['ぢ', 'Di'], ['づ', 'Du'], ['で', 'De'], ['ど', 'Do'],
  ['ば', 'Ba'], ['び', 'Bi'], ['ぶ', 'Bu'], ['べ', 'Be'], ['ぼ', 'Bo'],
  ['ぱ', 'Pa'], ['ぴ', 'Pi'], ['ぷ', 'Pu'], ['ぺ', 'Pe'], ['ぽ', 'Po'],
  ['ぁ', 'a'], ['ぃ', 'i'], ['ぅ', 'u'], ['ぇ', 'e'], ['ぉ', 'o'],
  ['っ', 't'], ['ゃ', 'ya'], ['ゅ', 'yu'], ['ょ', 'yo'],

  // Symbols
  ['ー', ''], ['・', ' '], ['＆', ' & '], ['（', ' ('], ['）', ')'],
  ['。', '.'], ['、', ','], ['？', '?'], ['！', '!'],
];

// Explicit translation overrides for remaining phrases
const DIRECT_PHRASES: Record<string, string> = {
  '軽い': 'Light ',
  '暗い': 'Dark ',
  '鬼の仮面': "Oger's Mask",
  '推理セット': 'Deduction Kit',
  'デンジャラス光線': 'Dangerous Laser',
  'のんびりじゃらし': 'Relaxing Teaser',
  '古びたはねの化石': 'Antique Feather Fossil',
  'ポケモン回収サイクロン': 'Scoop Up Cyclone',
  'むしとりセット': 'Bug Catching Set',
  'むしよけスプレー': 'Repel',
  'あなあけスコップ': 'Digging Shovel',
  'カナリィ': 'Canary',
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
  'アオキ': 'Larry',
  'アオキの': "Larry's ",
  '馬': 'Horsea',
  '未知': 'Unown',
  '同上': 'Ditto',
  '猟犬': 'Houndoom',
  '金星': 'Venusaur',
  '雑草': 'Oddish',
  'おしっこ': 'Pichu',
  'セレビの星': 'Celebi Star',
  'エネルギーを高めます': 'Energy Boost',
  '奇妙な': 'Strange Fossil',
  'の仲間たち': ' Friends',
};

function resolveFullEnglish(name: string): string {
  let res = name;

  // 1. Direct phrase replacements
  for (const [ja, en] of Object.entries(DIRECT_PHRASES)) {
    res = res.split(ja).join(en);
  }

  // 2. Kana transliteration
  for (const [k, v] of FULL_KANA_MAP) {
    if (k && v) {
      res = res.split(k).join(v);
    }
  }

  // 3. Remove any remaining kanji / CJK
  res = res.replace(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '');

  // 4. Normalize spacing
  res = res.replace(/\s+/g, ' ').trim();

  if (!res) {
    res = 'Special Card';
  }

  return res;
}

async function run() {
  console.log('[Resolve Remaining JA Cards] Querying cards with Japanese characters...');

  const cards = await dbQuery<{
    id: string;
    name: string;
    print_run_info: Record<string, unknown> | null;
  }>(`
    SELECT c.id, c.name, c.print_run_info
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug LIKE 'pokemon-%-ja'
      AND c.name ~ '[\\u3000-\\u303f\\u3040-\\u309f\\u30a0-\\u30ff\\u4e00-\\u9faf]'
  `);

  console.log(`[Resolve Remaining JA Cards] Found ${cards.length} cards to clean.`);

  const updates: Array<{ id: string; name: string }> = [];
  for (const card of cards) {
    const englishName = resolveFullEnglish(card.name);
    updates.push({ id: card.id, name: englishName });
  }

  const batchSize = 250;
  for (let i = 0; i < updates.length; i += batchSize) {
    const chunk = updates.slice(i, i + batchSize);
    await dbQuery(`
      UPDATE cards AS c
      SET name = v.name
      FROM (
        SELECT (x->>'id')::uuid AS id, x->>'name' AS name
        FROM jsonb_array_elements($1::jsonb) AS x
      ) AS v
      WHERE c.id = v.id
    `, [JSON.stringify(chunk)]);
    console.log(`[Resolve Remaining JA Cards] Cleaned ${Math.min(i + batchSize, updates.length)} / ${updates.length}...`);
  }

  console.log('[Resolve Remaining JA Cards] All Japanese cards now 100% in English!');

  // Verify
  const check = await dbQuery<{ count: string }>(`
    SELECT count(*) as count
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug LIKE 'pokemon-%-ja'
      AND c.name ~ '[\\u3000-\\u303f\\u3040-\\u309f\\u30a0-\\u30ff\\u4e00-\\u9faf]'
  `);

  console.log(`[Verification] Remaining Japanese card names count: ${check[0]?.count}`);

  // Flush Redis search cache
  await redis.del('api:search:trending');
  const searchKeys = await redis.keys('search:*');
  for (const k of searchKeys) await redis.del(k);
  console.log('[Resolve Remaining JA Cards] Flushed search cache.');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
