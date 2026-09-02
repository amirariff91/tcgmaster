import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

interface DbCard {
  id: string;
  name: string;
  slug: string;
  number: string;
  tcg_player_id: string;
  set_name: string;
}

interface TcgPrice {
  productId: number;
  marketPrice?: number;
  lowPrice?: number;
  midPrice?: number;
  highPrice?: number;
  directLowPrice?: number;
  subTypeName?: string;
}

interface TcgGroup {
  groupId: number;
  name: string;
  abbreviation: string;
}

async function ingestRiftboundPrices() {
  console.log('[Riftbound Price Ingestion] Loading mapped Riftbound cards...');

  const cards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.slug, c.number, c.tcg_player_id, s.name as set_name
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'riftbound'
      AND c.tcg_player_id IS NOT NULL
  `);

  console.log(`[Riftbound Price Ingestion] Found ${cards.length} mapped Riftbound cards.`);
  if (cards.length === 0) return;

  const cardsByProductId = new Map<number, DbCard>();
  for (const c of cards) {
    const numId = parseInt(c.tcg_player_id, 10);
    if (!isNaN(numId)) cardsByProductId.set(numId, c);
  }

  // Fetch all groups from Category 89 (Riftbound)
  console.log('[Riftbound Price Ingestion] Fetching Riftbound groups from Category 89...');
  const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/89/groups', {
    headers: { 'User-Agent': 'curl/8.4.0' },
  });
  const groupsData = await groupsRes.json();
  const groups: TcgGroup[] = groupsData.results || [];
  console.log(`[Riftbound Price Ingestion] Found ${groups.length} groups.`);

  const historyInserts: any[] = [];
  const currentPriceUpdates: Array<{
    card_id: string;
    headline_cents: number;
    source_prices: Record<string, unknown>;
  }> = [];

  for (const g of groups) {
    try {
      console.log(`[Riftbound Price Ingestion] Fetching prices for "${g.name}" (Group ${g.groupId})...`);
      const res = await fetch(`https://tcgcsv.com/tcgplayer/89/${g.groupId}/prices`, {
        headers: { 'User-Agent': 'curl/8.4.0' },
      });
      if (!res.ok) continue;

      const data = await res.json();
      const prices: TcgPrice[] = data.results || [];

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
      }
    } catch (e) {
      console.error(`Error fetching prices for group ${g.name}:`, e);
    }
  }

  console.log(`\n========================================`);
  console.log(`[Riftbound Price Ingestion] Ingesting ${historyInserts.length} price observations...`);
  console.log(`========================================\n`);

  // 1. Batch insert into price_history
  const batchSize = 250;
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

  // 2. Batch upsert into card_price_current (dedup by card_id)
  const uniqueUpdates = Array.from(
    new Map(currentPriceUpdates.map((item) => [item.card_id, item])).values(),
  );

  for (let i = 0; i < uniqueUpdates.length; i += batchSize) {
    const chunk = uniqueUpdates.slice(i, i + batchSize);
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

  console.log(`[Riftbound Price Ingestion] Successfully priced ${uniqueUpdates.length} Riftbound cards!`);

  // Flush Redis caches
  await redis.del('api:search:trending');
  const searchKeys = await redis.keys('search:*');
  for (const k of searchKeys) await redis.del(k);
  console.log('[Riftbound Price Ingestion] Flushed Redis caches.');
}

ingestRiftboundPrices()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
