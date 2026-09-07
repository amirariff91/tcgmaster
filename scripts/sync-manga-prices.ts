import { pool } from '../lib/db/client';

const TARGETS: Array<{ slug: string; id: number; name: string }> = [
  { slug: 'op-op03-122_p2', id: 500118, name: 'Sogeking (Manga)' },
  { slug: 'op-op04-083_p2', id: 516558, name: 'Sabo (Manga)' },
  { slug: 'op-op06-118_p2', id: 543632, name: 'Zoro (Manga)' },
  { slug: 'op-op07-051_p2', id: 553940, name: 'Hancock (Manga)' },
  { slug: 'op-op08-118_p2', id: 568019, name: 'Rayleigh (Manga)' },
  { slug: 'op-op10-119_p2', id: 617173, name: 'Law (Manga)' },
  { slug: 'op-op14-119_p2', id: 671448, name: 'Mihawk (Manga)' },
  { slug: 'op-op15-118_p2', id: 685479, name: 'Enel (Manga)' },
  { slug: 'op-op16-065_p2', id: 695986, name: 'Sakazuki (Manga)' },
  { slug: 'op-eb02-061_p2', id: 629167, name: 'Luffy (Manga)' },
  { slug: 'op-eb03-061_p2', id: 672817, name: 'Uta (Manga)' },
  { slug: 'op-eb04-044_p2', id: 685313, name: 'Koby (Manga)' },
];

async function syncMangaPrices() {
  console.log('Fetching One Piece TCGCSV groups...');
  const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/68/groups', {
    headers: { 'User-Agent': 'curl/8.4.0' },
  });
  const groups = (await groupsRes.json()).results || [];

  for (const t of TARGETS) {
    let foundGroup: any = null;
    let foundProduct: any = null;
    let foundPrice: number | null = null;

    for (const g of groups) {
      const prodRes = await fetch(`https://tcgcsv.com/tcgplayer/68/${g.groupId}/products`, {
        headers: { 'User-Agent': 'curl/8.4.0' },
      });
      const products = (await prodRes.json()).results || [];
      const p = products.find((x: any) => x.productId === t.id);
      if (p) {
        foundGroup = g;
        foundProduct = p;
        const pricesRes = await fetch(`https://tcgcsv.com/tcgplayer/68/${g.groupId}/prices`, {
          headers: { 'User-Agent': 'curl/8.4.0' },
        });
        const prices = (await pricesRes.json()).results || [];
        const priceItem = prices.find((x: any) => x.productId === t.id);
        foundPrice = priceItem?.marketPrice || priceItem?.midPrice || priceItem?.lowPrice;
        break;
      }
    }

    if (foundProduct && foundPrice) {
      console.log(`[FOUND] ${t.slug} -> Product ID ${t.id} (${foundProduct.name}) in "${foundGroup.name}": Market = $${foundPrice}`);

      const cardRes = await pool.query(`SELECT id FROM cards WHERE slug = $1`, [t.slug]);
      const cardId = cardRes.rows[0]?.id;
      if (cardId) {
        // 1. Update mapping
        await pool.query(
          `INSERT INTO card_source_mapping (card_id, source, external_id, external_title, confidence, matched_by, updated_at)
           VALUES ($1, 'tcgplayer', $2, $3, 'confirmed', 'manual', NOW())
           ON CONFLICT (card_id, source)
           DO UPDATE SET external_id = EXCLUDED.external_id,
                         external_title = EXCLUDED.external_title,
                         confidence = 'confirmed',
                         matched_by = 'manual',
                         updated_at = NOW()`,
          [cardId, String(t.id), foundProduct.name]
        );

        // 2. Update card tcg_player_id
        await pool.query(`UPDATE cards SET tcg_player_id = $1 WHERE id = $2`, [String(t.id), cardId]);

        // 3. Insert into price_history
        await pool.query(
          `INSERT INTO price_history (card_id, source, grade, price, price_native, currency, price_kind, recorded_at)
           VALUES ($1, 'tcgplayer', 'raw', $2, $2, 'USD', 'market', NOW())`,
          [cardId, foundPrice]
        );

        // 4. Update card_price_current
        const headlineCents = Math.round(foundPrice * 100);
        await pool.query(
          `INSERT INTO card_price_current (
             card_id, headline_cents, headline_source, headline_kind, headline_currency, headline_grade,
             source_prices, computed_at
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
          [cardId, headlineCents, foundPrice]
        );
        console.log(`[UPDATED DB] ${t.slug} headline = $${foundPrice} (${headlineCents} cents)`);
      }
    } else {
      console.log(`[NOT FOUND] ${t.slug} (ID ${t.id})`);
    }
  }

  // Update mapping-dictionary.json
  const fs = await import('fs/promises');
  const dictPath = 'lib/price-engine/mapping-dictionary.json';
  try {
    const raw = await fs.readFile(dictPath, 'utf-8');
    const dict = JSON.parse(raw);
    for (const t of TARGETS) {
      dict[t.slug] = t.id;
    }
    await fs.writeFile(dictPath, JSON.stringify(dict, null, 2) + '\n');
    console.log('[UPDATED] lib/price-engine/mapping-dictionary.json with verified Manga IDs');
  } catch (e) {
    console.error('Failed to update mapping dictionary:', e);
  }

  console.log('\nAll Manga cards successfully synced with live TCGPlayer prices!');
  process.exit(0);
}

syncMangaPrices().catch(err => {
  console.error(err);
  process.exit(1);
});
