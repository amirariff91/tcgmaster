import { pool } from '../lib/db/client';
import * as fs from 'fs';

async function run() {
  const fixes = [
    { slug: 'op-op06-118_p2', groupId: 23272, prodId: 541660, name: 'Roronoa Zoro (Alternate Art) (Manga)' },
    { slug: 'op-op07-051_p2', groupId: 23387, prodId: 545841, name: 'Boa Hancock (051) (Parallel) (Manga)' },
    { slug: 'op-op08-118_p2', groupId: 23462, prodId: 558162, name: 'Silvers Rayleigh (Parallel) (Manga)' },
  ];

  for (const f of fixes) {
    const pricesRes = await fetch(`https://tcgcsv.com/tcgplayer/68/${f.groupId}/prices`, {
      headers: { 'User-Agent': 'curl/8.4.0' }
    });
    const prices = (await pricesRes.json()).results || [];
    const item = prices.find((x: any) => x.productId === f.prodId);
    const marketPrice = item?.marketPrice || item?.midPrice;
    console.log(`[FIX] ${f.slug} -> Product ID ${f.prodId} (${f.name}): Market Price = $${marketPrice}`);

    const cardRes = await pool.query('SELECT id FROM cards WHERE slug = $1', [f.slug]);
    const cardId = cardRes.rows[0]?.id;
    if (cardId && marketPrice) {
      await pool.query(
        `INSERT INTO card_source_mapping (card_id, source, external_id, external_title, confidence, matched_by, updated_at)
         VALUES ($1, 'tcgplayer', $2, $3, 'confirmed', 'manual', NOW())
         ON CONFLICT (card_id, source)
         DO UPDATE SET external_id = EXCLUDED.external_id,
                       external_title = EXCLUDED.external_title,
                       confidence = 'confirmed',
                       matched_by = 'manual',
                       updated_at = NOW()`,
        [cardId, String(f.prodId), f.name]
      );

      await pool.query('UPDATE cards SET tcg_player_id = $1 WHERE id = $2', [String(f.prodId), cardId]);

      // Move any previous corrupted prices for this card to quarantine first
      const hist = await pool.query("SELECT id FROM price_history WHERE card_id = $1 AND source = 'tcgplayer' AND price < 200", [cardId]);
      if (hist.rows.length > 0) {
        const ids = hist.rows.map(r => `'${r.id}'`).join(',');
        await pool.query(`
          INSERT INTO price_quarantine (card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at)
          SELECT card_id, source, grade, price, price_native, currency, price_kind, 'manual-mapping-correction',
                 jsonb_build_object('note', 'Contaminated alt art on manga', 'old_price', price), recorded_at
          FROM price_history WHERE id IN (${ids})
        `);
        await pool.query(`DELETE FROM price_history WHERE id IN (${ids})`);
      }

      await pool.query(
        `INSERT INTO price_history (card_id, source, grade, price, price_native, currency, price_kind, recorded_at)
         VALUES ($1, 'tcgplayer', 'raw', $2, $2, 'USD', 'market', NOW())`,
        [cardId, marketPrice]
      );

      const headlineCents = Math.round(marketPrice * 100);
      await pool.query(
        `INSERT INTO card_price_current (
          card_id, headline_cents, headline_source, headline_kind, headline_currency, headline_grade, source_prices, computed_at
        )
        VALUES ($1, $2, 'tcgplayer', 'market', 'USD', 'raw', jsonb_build_object('tcgplayer', jsonb_build_object('usd', $3::numeric)), NOW())
        ON CONFLICT (card_id)
        DO UPDATE SET headline_cents = EXCLUDED.headline_cents,
                      headline_source = EXCLUDED.headline_source,
                      headline_kind = EXCLUDED.headline_kind,
                      headline_currency = EXCLUDED.headline_currency,
                      headline_grade = EXCLUDED.headline_grade,
                      source_prices = jsonb_set(
                        COALESCE(card_price_current.source_prices, '{}'::jsonb),
                        '{tcgplayer}',
                        jsonb_build_object('usd', $3::numeric)::jsonb
                      ),
                      computed_at = NOW()`,
        [cardId, headlineCents, marketPrice]
      );

      console.log(`[DONE] ${f.slug} successfully updated to $${marketPrice} (${headlineCents} cents)!`);
    }
  }

  // Update dictionary
  const dictPath = 'lib/price-engine/mapping-dictionary.json';
  const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
  for (const f of fixes) {
    dict[f.slug] = f.prodId;
  }
  fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2) + '\n');
  console.log('Updated mapping-dictionary.json with OP06, OP07, OP08 Manga IDs');

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
