import * as cheerio from 'cheerio';
import { dbQuery, pool } from '../lib/db/client';

interface BandaiCard {
  id: string; // e.g. P-152
  number: string;
  nameJa: string;
  rarity: string;
  category: string;
  imageUrl: string;
  slug: string;
}

const OFFICIAL_NAME_MAP: Record<string, string> = {
  'モンキー・D・ルフィ': 'Monkey.D.Luffy',
  'ロロノア・ゾロ': 'Roronoa Zoro',
  'ナミ': 'Nami',
  'ウソップ': 'Usopp',
  'サンジ': 'Sanji',
  'トニートニー・チョッパー': 'Tony Tony.Chopper',
  'ニコ・ロビン': 'Nico Robin',
  'フランキー': 'Franky',
  'ブルック': 'Brook',
  'ジンベエ': 'Jinbe',
  'トラファルガー・ロー': 'Trafalgar Law',
  'ユースタス・キッド': 'Eustass"Captain"Kid',
  'ポートガス・D・エース': 'Portgas.D.Ace',
  'サボ': 'Sabo',
  'シャンクス': 'Shanks',
  'エドワード・ニューゲート': 'Edward.Newgate',
  'クザン': 'Kuzan',
  'スモーカー': 'Smoker',
  'ボア・ハンコック': 'Boa Hancock',
  'ドンキホーテ・ドフラミンゴ': 'Donquixote Doflamingo',
  'クロコダイル': 'Crocodile',
  'ジュラキュール・ミホーク': 'Dracule Mihawk',
  'シャーロット・リンリン': 'Charlotte Linlin',
  'シャーロット・カタクリ': 'Charlotte Katakuri',
  'カイドウ': 'Kaidou',
  'ヤマト': 'Yamato',
  '光月おでん': 'Kouzuki Oden',
  'ウタ': 'Uta',
  'リリス': 'Lilith',
};

async function syncJapanesePromos() {
  console.log('[Bandai JP Promo Sync] Fetching official promo card list...');

  const res = await fetch('https://onepiece-cardgame.com/cardlist/?series=550901', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch from onepiece-cardgame.com: ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Get set_id for 'op-550901' (Promotion card)
  const setRows = await dbQuery<{ id: string }>(`SELECT id FROM sets WHERE slug = 'op-550901' LIMIT 1`);
  if (setRows.length === 0) {
    throw new Error('Promo set op-550901 not found in database.');
  }
  const setId = setRows[0].id;

  const cards: BandaiCard[] = [];

  $('dl.modalCol').each((_, el) => {
    const cardId = $(el).attr('id')?.trim(); // e.g. P-152
    if (!cardId || !cardId.startsWith('P-')) return;

    const infoText = $(el).find('.infoCol').text();
    const nameJa = $(el).find('.cardName').text().trim();
    const imgSrc = $(el).find('.frontCol img').attr('data-src') || $(el).find('.frontCol img').attr('src');
    
    // Parse info parts: P-152 | P | CHARACTER
    const parts = infoText.split('|').map(s => s.trim());
    const number = parts[0] || cardId;
    const rarity = parts[1] || 'P';
    const category = parts[2] || 'CHARACTER';

    const cleanNum = number.toLowerCase().replace(/[^a-z0-9_]/g, '-');
    const slug = `op-${cleanNum}-ja`;
    const fullImageUrl = imgSrc ? (imgSrc.startsWith('http') ? imgSrc : `https://www.onepiece-cardgame.com${imgSrc.replace('../', '/')}`) : '';

    cards.push({
      id: cardId,
      number,
      nameJa,
      rarity: rarity === 'P' ? 'Promo' : rarity,
      category,
      imageUrl: fullImageUrl,
      slug,
    });
  });

  console.log(`[Bandai JP Promo Sync] Parsed ${cards.length} official promo cards from Bandai!`);

  let newCount = 0;
  let updatedCount = 0;

  for (const c of cards) {
    const englishName = OFFICIAL_NAME_MAP[c.nameJa] || c.nameJa;

    const res = await dbQuery<{ id: string }>(
      `INSERT INTO cards (
         set_id, name, slug, number, rarity, image_url, print_run_info
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (set_id, slug) DO UPDATE SET
         image_url = EXCLUDED.image_url,
         rarity = EXCLUDED.rarity,
         print_run_info = EXCLUDED.print_run_info
       RETURNING id`,
      [
        setId,
        englishName,
        c.slug,
        c.number,
        c.rarity,
        c.imageUrl,
        JSON.stringify({
          ja_name: c.nameJa,
          category: c.category,
          official_bandai_id: c.id,
          language: 'ja',
        }),
      ]
    );

    if (res.length > 0) {
      newCount++;
    }
  }

  console.log(`[Bandai JP Promo Sync] Successfully processed ${newCount} Japanese promo cards into op-550901!`);
}

syncJapanesePromos()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
