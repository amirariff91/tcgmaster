import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

interface TcgPrice {
  productId: number;
  marketPrice?: number;
  lowPrice?: number;
  midPrice?: number;
  highPrice?: number;
  directLowPrice?: number;
  subTypeName?: string;
}

interface DbCard {
  id: string;
  name: string;
  slug: string;
  number: string;
  tcg_player_id: string;
}

async function ingestPokemonJaPrices() {
  console.log('[Pokemon JA Price Ingestor] Loading mapped Japanese cards...');

  const cards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.slug, c.number, c.tcg_player_id
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE c.tcg_player_id IS NOT NULL
      AND s.slug LIKE 'pokemon-%-ja'
  `);

  console.log(`[Pokemon JA Price Ingestor] Found ${cards.length} mapped Japanese cards.`);
  if (cards.length === 0) return;

  const cardsByProductId = new Map<number, DbCard>();
  for (const c of cards) {
    const numId = parseInt(c.tcg_player_id, 10);
    if (!isNaN(numId)) cardsByProductId.set(numId, c);
  }

  // Fetch all Category 85 groups
  const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/85/groups', {
    headers: { 'User-Agent': 'curl/8.4.0' },
  });
  if (!groupsRes.ok) return;

  const groupsData = await groupsRes.json();
  const groups: Array<{ groupId: number; name: string }> = groupsData.results || [];

  let totalObservations = 0;
  const currentPriceUpdates: Array<{
    card_id: string;
    headline_cents: number;
    source_prices: Record<string, unknown>;
  }> = [];

  for (const group of groups) {
    try {
      const pricesRes = await fetch(`https://tcgcsv.com/tcgplayer/85/${group.groupId}/prices`, {
        headers: { 'User-Agent': 'curl/8.4.0' },
      });
      if (!pricesRes.ok) continue;

      const pricesData = await pricesRes.json();
      const prices: TcgPrice[] = pricesData.results || [];

      for (const p of prices) {
        const dbCard = cardsByProductId.get(p.productId);
        if (!dbCard) continue;

        const bestPrice = p.marketPrice || p.midPrice || p.lowPrice || p.directLowPrice;
        if (!bestPrice || bestPrice <= 0) continue;

        const headlineCents = Math.round(bestPrice * 100);

        // Record observation in price_history
        await dbQuery(`
          INSERT INTO price_history (card_id, source, raw_price, price_usd, condition, is_foil, timestamp)
          VALUES ($1, 'tcgplayer', $2, $3, 'Near Mint', false, NOW())
        `, [dbCard.id, bestPrice, bestPrice]);

        totalObservations++;

        currentPriceUpdates.push({
          card_id: dbCard.id,
          headline_cents: headlineCents,
          source_prices: {
            tcgplayer: {
              market: p.marketPrice || null,
              low: p.lowPrice || null,
              mid: p.midPrice || null,
              high: p.highPrice || null,
              direct_low: p.directLowPrice || null,
              sub_type: p.subTypeName || 'Normal',
              updated_at: new Date().toISOString(),
            },
          },
        });
      }
    } catch (err) {
      console.error(`Error ingesting prices for group ${group.groupId}:`, err);
    }
  }

  console.log(`[Pokemon JA Price Ingestor] Upserting ${currentPriceUpdates.length} active headline prices...`);

  // Batch update card_price_current
  for (let i = 0; i < currentPriceUpdates.length; i += 100) {
    const batch = currentPriceUpdates.slice(i, i + 100);
    for (const u of batch) {
      await dbQuery(`
        INSERT INTO card_price_current (card_id, source_prices, headline_cents, headline_source, headline_kind, headline_currency, computed_at)
        VALUES ($1, $2, $3, 'tcgplayer', 'active_listing', 'USD', NOW())
        ON CONFLICT (card_id) DO UPDATE
        SET source_prices = card_price_current.source_prices || EXCLUDED.source_prices,
            headline_cents = EXCLUDED.headline_cents,
            headline_source = 'tcgplayer',
            computed_at = NOW()
      `, [u.card_id, JSON.stringify(u.source_prices), u.headline_cents]);
    }
  }

  // Update last_price_fetch on cards table
  await dbQuery(`
    UPDATE cards c
    SET last_price_fetch = NOW()
    FROM card_price_current cpc
    JOIN sets s ON s.id = c.set_id
    WHERE c.id = cpc.card_id AND s.slug LIKE 'pokemon-%-ja'
  `);

  console.log(`\n========================================`);
  console.log(`[Pokemon JA Price Ingestor] Successfully recorded ${totalObservations} price observations!`);
  console.log(`[Pokemon JA Price Ingestor] Updated ${currentPriceUpdates.length} Japanese cards with live market prices!`);
  console.log(`========================================\n`);

  // Flush Redis caches
  const searchKeys = await redis.keys('search:*');
  for (const k of searchKeys) await redis.del(k);
  await redis.del('api:search:trending');
  console.log('[Pokemon JA Price Ingestor] Flushed Redis search caches.');
}

ingestPokemonJaPrices()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
