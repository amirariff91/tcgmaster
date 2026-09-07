import { pool } from '../lib/db/client';
import * as fs from 'fs';

interface AuditItem {
  cardId: string;
  slug: string;
  dbName: string;
  cardNumber: string;
  currentId: string;
  currentTitle: string;
  headlinePrice: string;
  issueType: string;
  recommendedProduct?: {
    productId: number;
    name: string;
    cleanName: string;
    imageUrl: string;
    groupId: number;
    url: string;
  };
}

// 12 Real English Manga Cards that collapsed to base Alternate Art
const REAL_MANGA_MAPPING: Record<string, { tcgId: number; tcgTitle: string }> = {
  'op-op03-122_p2': { tcgId: 587710, tcgTitle: 'Sogeking (Manga)' },
  'op-op04-083_p2': { tcgId: 587958, tcgTitle: 'Sabo (OP04-083) (Manga)' },
  'op-op06-118_p2': { tcgId: 587964, tcgTitle: 'Roronoa Zoro (Manga)' },
  'op-op07-051_p2': { tcgId: 545841, tcgTitle: 'Boa Hancock (051) (Parallel) (Manga)' },
  'op-op08-118_p2': { tcgId: 558162, tcgTitle: 'Silvers Rayleigh (Parallel) (Manga)' },
  'op-op10-119_p2': { tcgId: 617173, tcgTitle: 'Trafalgar Law (119) (Manga)' },
  'op-op14-119_p2': { tcgId: 671448, tcgTitle: 'Dracule Mihawk (Manga)' },
  'op-op15-118_p2': { tcgId: 685479, tcgTitle: 'Enel (OP15-118) (Manga)' },
  'op-op16-065_p2': { tcgId: 695986, tcgTitle: 'Sakazuki (Manga)' },
  'op-eb02-061_p2': { tcgId: 629167, tcgTitle: 'Monkey.D.Luffy (061) (Manga)' },
  'op-eb03-061_p2': { tcgId: 672817, tcgTitle: 'Uta (061) (Manga)' },
  'op-eb04-044_p2': { tcgId: 685313, tcgTitle: 'Koby (EB04-044) (Manga)' },
};

// 17 Cards with false "Manga Alternate Art" name in DB that are actually Tournament / Promo / Alt Arts
const FALSE_MANGA_NAME_CORRECTIONS: Record<string, string> = {
  'op-eb01-048_p2': 'Laboon (Treasure Cup 2025)',
  'op-eb02-026_p2': 'Nefeltari Vivi (Alternate Art)',
  'op-op01-070_p2': 'Dracule Mihawk (Alternate Art)',
  'op-op02-036_p2': 'Nami (Alternate Art)',
  'op-op03-013_p2': 'Marco (Alternate Art)',
  'op-op07-064_p2': 'Sanji (Parallel)',
  'op-op08-069_p2': 'Charlotte Linlin (Parallel)',
  'op-op11-054_p2': 'Nami (Alternate Art)',
  'op-op11-067_p2': 'Charlotte Katakuri (Alternate Art)',
  'op-op12-094_p2': 'Monkey.D.Dragon (Alternate Art)',
  'op-op12-119_p2': 'Bartholomew Kuma (Alternate Art)',
  'op-op14-033_p2': 'Perona (Extra Grand Battle 2026)',
  'op-st01-012_p2': 'Monkey.D.Luffy (Alternate Art)',
  'op-st01-013_p2': 'Roronoa Zoro (Alternate Art)',
  'op-st13-015_p2': 'Monkey.D.Luffy (Parallel)',
  'op-st16-004_p2': 'Shanks (Alternate Art)',
  'op-st21-015_p2': 'Roronoa Zoro (Parallel)',
};

async function fixEnglishOnePiece() {
  console.log('=== Step 1: Correcting False "Manga Alternate Art" Titles in DB ===');
  for (const [slug, correctName] of Object.entries(FALSE_MANGA_NAME_CORRECTIONS)) {
    const res = await pool.query(
      `UPDATE cards SET name = $1 WHERE slug = $2 RETURNING id, slug, name`,
      [correctName, slug]
    );
    if (res.rowCount && res.rowCount > 0) {
      console.log(`Updated title for ${slug}: "${correctName}"`);
    }
  }

  console.log('\n=== Step 2: Remapping Real Manga Cards to True TCGPlayer Manga Products ===');
  const fixedCardIds: string[] = [];

  for (const [slug, mapping] of Object.entries(REAL_MANGA_MAPPING)) {
    // 1. Get card ID
    const cardRes = await pool.query(`SELECT id FROM cards WHERE slug = $1`, [slug]);
    if (cardRes.rows.length === 0) continue;
    const cardId = cardRes.rows[0].id;
    fixedCardIds.push(cardId);

    // 2. Update card_source_mapping
    await pool.query(
      `INSERT INTO card_source_mapping (card_id, source, external_id, external_title, confidence, matched_by, updated_at)
       VALUES ($1, 'tcgplayer', $2, $3, 'confirmed', 'manual', NOW())
       ON CONFLICT (card_id, source)
       DO UPDATE SET external_id = EXCLUDED.external_id,
                     external_title = EXCLUDED.external_title,
                     confidence = 'confirmed',
                     matched_by = 'manual',
                     updated_at = NOW()`,
      [cardId, String(mapping.tcgId), mapping.tcgTitle]
    );

    // 3. Update cards table tcg_player_id
    await pool.query(
      `UPDATE cards SET tcg_player_id = $1 WHERE id = $2`,
      [String(mapping.tcgId), cardId]
    );

    console.log(`Remapped ${slug} -> TCGPlayer Product ${mapping.tcgId} ("${mapping.tcgTitle}")`);
  }

  console.log('\n=== Step 3: Quarantine Migration for Corrupted Price History (Pattern 10) ===');
  // Strict rule: NO DELETE DATA. Move rows into price_quarantine before scrubbing from price_history.
  const historyRows = await pool.query(
    `SELECT ph.id, ph.card_id, ph.source, ph.grade, ph.price, ph.price_native, ph.currency, ph.price_kind, ph.recorded_at, c.slug
     FROM price_history ph
     JOIN cards c ON ph.card_id = c.id
     WHERE ph.card_id = ANY($1) AND ph.source = 'tcgplayer'`,
    [fixedCardIds]
  );

  console.log(`Found ${historyRows.rows.length} corrupted price history entries to quarantine.`);

  if (historyRows.rows.length > 0) {
    const ids = historyRows.rows.map(r => `'${r.id}'`).join(',');

    // Move to price_quarantine
    await pool.query(`
      INSERT INTO price_quarantine (
        card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at
      )
      SELECT card_id, source, grade, price, price_native, currency, price_kind,
             'manual-mapping-correction',
             jsonb_build_object('note', 'Contaminated base/alt art price on Manga variant', 'old_price', price),
             recorded_at
      FROM price_history
      WHERE id IN (${ids})
    `);

    // Delete from price_history
    await pool.query(`
      DELETE FROM price_history
      WHERE id IN (${ids})
    `);

    console.log(`Successfully migrated ${historyRows.rows.length} rows to price_quarantine.`);
  }

  console.log('\n=== Step 4: Fetching Fresh Live Prices from TCGPlayer & Recomputing Headline Prices ===');
  for (const [slug, mapping] of Object.entries(REAL_MANGA_MAPPING)) {
    try {
      const priceRes = await fetch(`https://tcgcsv.com/tcgplayer/68/product/${mapping.tcgId}/prices`, {
        headers: { 'User-Agent': 'TCGMaster/1.0' }
      });
      if (!priceRes.ok) {
        console.error(`Failed to fetch fresh price for product ${mapping.tcgId}`);
        continue;
      }
      const priceData = await priceRes.json();
      const results = priceData.results || [];
      const marketPrice = results.find((p: any) => p.subTypeName === 'Normal')?.marketPrice || results[0]?.marketPrice;

      if (marketPrice && marketPrice > 0) {
        const cardRes = await pool.query(`SELECT id FROM cards WHERE slug = $1`, [slug]);
        const cardId = cardRes.rows[0].id;

        // 1. Insert fresh clean price into price_history
        await pool.query(`
          INSERT INTO price_history (card_id, source, grade, price, price_native, currency, price_kind, recorded_at)
          VALUES ($1, 'tcgplayer', 'raw', $2, $2, 'USD', 'market', NOW())
        `, [cardId, marketPrice]);

        // 2. Update card_price_current headline_cents and source_prices
        const headlineCents = Math.round(marketPrice * 100);
        await pool.query(`
          INSERT INTO card_price_current (card_id, headline_cents, source_prices, updated_at)
          VALUES ($1, $2, jsonb_build_object('tcgplayer', jsonb_build_object('usd', $3)), NOW())
          ON CONFLICT (card_id)
          DO UPDATE SET headline_cents = EXCLUDED.headline_cents,
                        source_prices = jsonb_set(
                          COALESCE(card_price_current.source_prices, '{}'::jsonb),
                          '{tcgplayer}',
                          jsonb_build_object('usd', $3)::jsonb
                        ),
                        updated_at = NOW()
        `, [cardId, headlineCents, marketPrice]);

        console.log(`Updated ${slug}: New Live TCGPlayer Price = $${marketPrice.toFixed(2)} (${headlineCents} cents)`);
      }
    } catch (err) {
      console.error(`Error updating price for ${slug}:`, err);
    }
  }

  console.log('\nEnglish One Piece Manga & TCGPlayer Mismatch Remediation Complete!');
  process.exit(0);
}

fixEnglishOnePiece().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
