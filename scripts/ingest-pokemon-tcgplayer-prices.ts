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

async function ingestPokemonTcgPlayerPrices() {
  console.log('[Pokemon TCGplayer Price Ingestion] Loading mapped cards...');

  const cards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.slug, c.number, c.tcg_player_id
    FROM cards c
    WHERE c.tcg_player_id IS NOT NULL
      AND c.slug LIKE 'pokemon-%'
  `);

  console.log(`[Pokemon TCGplayer Price Ingestion] Found ${cards.length} mapped Pokemon cards.`);
  if (cards.length === 0) return;

  // Map product IDs to DB cards
  const cardsByProductId = new Map<number, DbCard>();
  for (const c of cards) {
    const numId = parseInt(c.tcg_player_id, 10);
    if (!isNaN(numId)) cardsByProductId.set(numId, c);
  }

  // Fetch all groups
  const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/3/groups', {
    headers: { 'User-Agent': 'curl/8.4.0' },
  });
  const groupsData = await groupsRes.json();
  const groups: Array<{ groupId: number; name: string }> = groupsData.results || [];

  let totalObservations = 0;
  const historyInserts: any[] = [];
  const currentPriceUpdates: Array<{
    card_id: string;
    headline_cents: number;
    source_prices: Record<string, unknown>;
  }> = [];

  for (const group of groups) {
    try {
      const pricesRes = await fetch(`https://tcgcsv.com/tcgplayer/3/${group.groupId}/prices`, {
        headers: { 'User-Agent': 'curl/8.4.0' },
      });
      const pricesData = await pricesRes.json();
      const prices: TcgPrice[] = pricesData.results || [];

      for (const p of prices) {
        const card = cardsByProductId.get(p.productId);
        if (!card || !p.marketPrice || p.marketPrice <= 0) continue;

        const priceUsd = p.marketPrice;
        const headlineCents = Math.round(priceUsd * 100);

        historyInserts.push({
          card_id: card.id,
          source: 'tcgplayer',
          grade: 'raw',
          grading_company_id: null,
          price: priceUsd,
          currency: 'USD',
          recorded_at: new Date().toISOString(),
        });

        currentPriceUpdates.push({
          card_id: card.id,
          headline_cents: headlineCents,
          source_prices: {
            tcgplayer: {
              market: priceUsd,
              low: p.lowPrice || priceUsd,
              mid: p.midPrice || priceUsd,
              high: p.highPrice || priceUsd,
              direct_low: p.directLowPrice || null,
              sub_type: p.subTypeName || 'Normal',
            },
          },
        });
        totalObservations++;
      }
    } catch (e) {
      console.error(`Error ingesting prices for group ${group.name}:`, e);
    }
  }

  console.log(`\n========================================`);
  console.log(`[Pokemon TCGplayer Price Ingestion] Ingesting ${historyInserts.length} price observations...`);
  console.log(`========================================\n`);

  // 1. Batch Insert into price_history
  const batchSize = 500;
  for (let i = 0; i < historyInserts.length; i += batchSize) {
    const chunk = historyInserts.slice(i, i + batchSize);
    await dbQuery(`
      INSERT INTO price_history (
        card_id, source, grade, grading_company_id, price, currency, recorded_at
      )
      SELECT card_id, source::price_source, grade, grading_company_id, price, currency, recorded_at
      FROM jsonb_to_recordset($1::jsonb) AS rows(
        card_id uuid,
        source text,
        grade text,
        grading_company_id uuid,
        price numeric,
        currency text,
        recorded_at timestamptz
      )
    `, [JSON.stringify(chunk)]);
  }

  // 2. Batch Upsert into card_price_current (deduplicate by card_id)
  const uniqueCurrentPriceUpdates = Array.from(
    new Map(currentPriceUpdates.map((item) => [item.card_id, item])).values(),
  );

  for (let i = 0; i < uniqueCurrentPriceUpdates.length; i += batchSize) {
    const chunk = uniqueCurrentPriceUpdates.slice(i, i + batchSize);
    await dbQuery(`
      INSERT INTO card_price_current (
        card_id, headline_cents, headline_source, headline_kind, headline_currency, headline_grade, source_prices, computed_at
      )
      SELECT
        x.card_id,
        x.headline_cents,
        'tcgplayer'::price_source,
        'market'::price_kind,
        'USD',
        'raw',
        x.source_prices,
        NOW()
      FROM jsonb_to_recordset($1::jsonb) AS x(
        card_id uuid,
        headline_cents integer,
        source_prices jsonb
      )
      ON CONFLICT (card_id) DO UPDATE
      SET
        headline_cents = EXCLUDED.headline_cents,
        headline_source = EXCLUDED.headline_source,
        headline_kind = EXCLUDED.headline_kind,
        headline_currency = EXCLUDED.headline_currency,
        headline_grade = EXCLUDED.headline_grade,
        source_prices = COALESCE(card_price_current.source_prices, '{}'::jsonb) || EXCLUDED.source_prices,
        computed_at = NOW()
    `, [JSON.stringify(chunk)]);
  }

  console.log(`[Pokemon TCGplayer Price Ingestion] Successfully priced ${currentPriceUpdates.length} Pokemon cards!`);

  // Flush Redis caches
  await redis.del('api:search:trending');
  const searchKeys = await redis.keys('search:*');
  for (const k of searchKeys) await redis.del(k);
  console.log('[Pokemon TCGplayer Price Ingestion] Flushed Redis caches.');
}

ingestPokemonTcgPlayerPrices()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
