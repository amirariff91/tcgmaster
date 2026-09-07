import { pool } from "../lib/db/client";

interface InfiniteHistoryVariant {
  variant: string;
  marketPrice: string;
  averageSalesPrice: string;
  quantity: string;
}

interface InfiniteHistoryItem {
  date: string; // YYYY-MM-DD
  variants: InfiniteHistoryVariant[];
}

interface LatestSaleItem {
  condition?: string;
  variant?: string;
  language?: string;
  quantity?: number;
  purchasePrice?: number;
  shippingPrice?: number;
  orderDate?: string;
}

/**
 * Fetches recent completed sales transactions from TCGPlayer's latestsales API.
 */
export async function fetchLatestCompletedSales(productId: string | number): Promise<LatestSaleItem[]> {
  try {
    const res = await fetch(`https://mpapi.tcgplayer.com/v2/product/${productId}/latestsales`, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []) as LatestSaleItem[];
  } catch (err: any) {
    console.warn(`[latestsales] Error for product ${productId}:`, err.message);
    return [];
  }
}

/**
 * Fetches 1-year historical sales records from TCGPlayer's Infinite API.
 */
export async function fetchAnnualHistory(productId: string | number): Promise<InfiniteHistoryItem[]> {
  try {
    const res = await fetch(`https://infinite-api.tcgplayer.com/price/history/${productId}?range=annual`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.result || []) as InfiniteHistoryItem[];
  } catch (err: any) {
    console.warn(`[infinite-api] Error for product ${productId}:`, err.message);
    return [];
  }
}

/**
 * Dual-Engine sync for a card:
 * 1. Cleanses fantasy asking prices to price_quarantine.
 * 2. Ingests 52 weeks of historical market/sale points from Market Price History into price_history.
 * 3. Ingests verified completed order transactions from Most Recent Sales into price_history.
 * 4. Sets card_price_current headline to the most accurate completed sale price (or historical market price).
 */
export async function syncDualEngineSales(
  cardId: string,
  externalId: string | number,
  options: { maxReasonablePrice?: number } = { maxReasonablePrice: 80000 }
) {
  const prodId = externalId.toString();

  // 1. Check existing price_history for unverified asking price spikes (e.g. > $1,000 that jump > 3x real sales)
  const existingHist = await pool.query(
    `SELECT * FROM price_history WHERE card_id = $1 AND source = 'tcgplayer'`,
    [cardId]
  );

  // 2. Fetch both TCGPlayer sources in parallel
  const [latestSales, annualHistory] = await Promise.all([
    fetchLatestCompletedSales(prodId),
    fetchAnnualHistory(prodId),
  ]);

  // Sort annual history chronologically
  annualHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Find latest valid point from annual history
  let latestHistoryPrice: number | null = null;
  let insertedHistoryCount = 0;

  for (const item of annualHistory) {
    if (!item.variants || item.variants.length === 0) continue;
    const variant = item.variants.find((v) => v.variant === "Foil") || item.variants[0];
    const avgSale = parseFloat(variant.averageSalesPrice || "0");
    const market = parseFloat(variant.marketPrice || "0");
    const pr = avgSale > 0 ? avgSale : market;

    if (pr > 0 && pr < (options.maxReasonablePrice || 80000)) {
      latestHistoryPrice = pr;
      const recordedAt = `${item.date}T12:00:00Z`;

      await pool.query(
        `
        INSERT INTO price_history (card_id, source, grade, price, price_native, currency, price_kind, recorded_at)
        VALUES ($1, 'tcgplayer', 'raw', $2, $2, 'USD', 'market', $3::timestamptz)
        ON CONFLICT DO NOTHING
        `,
        [cardId, pr, recordedAt]
      );
      insertedHistoryCount++;
    }
  }

  // Find latest completed sale from latestSales
  // Prioritize Near Mint Foil, then Near Mint, then any completed sale
  const nmFoilSale = latestSales.find(
    (s) => s.condition === "Near Mint" && s.variant === "Foil" && s.purchasePrice && s.purchasePrice > 0
  );
  const bestSale = nmFoilSale || latestSales.find((s) => s.purchasePrice && s.purchasePrice > 0);

  let latestSalePrice: number | null = null;
  if (bestSale && bestSale.purchasePrice && bestSale.purchasePrice < (options.maxReasonablePrice || 80000)) {
    latestSalePrice = bestSale.purchasePrice;
    const recordedAt = bestSale.orderDate || new Date().toISOString();

    await pool.query(
      `
      INSERT INTO price_history (card_id, source, grade, price, price_native, currency, price_kind, recorded_at)
      VALUES ($1, 'tcgplayer', 'raw', $2, $2, 'USD', 'market', $3::timestamptz)
      ON CONFLICT DO NOTHING
      `,
      [cardId, latestSalePrice, recordedAt]
    );
  }

  // The true headline price: Completed sale takes top priority, then latest history price
  const truePrice = latestSalePrice || latestHistoryPrice;

  // 3. Quarantine any existing records that are inflated listing asks (> 1.4x truePrice if truePrice is known)
  if (truePrice && truePrice > 0) {
    for (const r of existingHist.rows) {
      const p = parseFloat(r.price);
      if (p > truePrice * 1.4 && p > 500) {
        console.log(`[QUARANTINE] Card ${cardId} row ${r.id}: $${p} vs True $${truePrice}`);
        await pool.query(
          `
          INSERT INTO price_quarantine (card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'ratio-vs-median', $8, $9)
          `,
          [
            r.card_id,
            r.source,
            r.grade,
            r.price,
            r.price_native,
            r.currency,
            r.price_kind,
            JSON.stringify({
              note: "fantasy listing price removed; replaced by verified sales history",
              truePrice,
              originalRecordedAt: r.recorded_at,
            }),
            r.recorded_at,
          ]
        );
        await pool.query(`DELETE FROM price_history WHERE id = $1`, [r.id]);
      }
    }
  }

  // 4. Update current headline
  if (truePrice && truePrice > 0) {
    const headlineCents = Math.round(truePrice * 100);
    await pool.query(
      `
      INSERT INTO card_price_current (
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
                    computed_at = NOW()
      `,
      [cardId, headlineCents, truePrice]
    );

    await pool.query(`UPDATE cards SET price_cache_ttl = $1, last_price_fetch = NOW() WHERE id = $2`, [headlineCents, cardId]);
  } else {
    // If no sales at all, ensure we don't display a phantom price
    await pool.query(
      `
      UPDATE card_price_current
      SET headline_cents = NULL, headline_source = NULL,
          source_prices = source_prices - 'tcgplayer',
          computed_at = NOW()
      WHERE card_id = $1 AND headline_source = 'tcgplayer'
      `,
      [cardId]
    );
    await pool.query(`UPDATE cards SET price_cache_ttl = NULL WHERE id = $1`, [cardId]);
  }

  return {
    latestSalePrice,
    latestHistoryPrice,
    finalPrice: truePrice,
    insertedHistoryCount,
    salesCount: latestSales.length,
  };
}

// CLI runner if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  async function run() {
    console.log("Running dual-engine sync for target cards and scan for listing price traps...");

    // 1. Explicitly fix the known high-profile cards first
    const targetCards = [
      { slug: "op-op05-119_p2", externalId: "527026", title: "Monkey.D.Luffy (Manga)" },
      { slug: "op-op09-118_p2", externalId: "597065", title: "Gol.D.Roger (Manga)" },
      { slug: "op-op02-013_r1", externalId: "587709", title: "Portgas.D.Ace (OP02-013 Reprint)" },
      // OP13 Ace variants exact mapping
      { slug: "op-op13-119", externalId: "657405", title: "Portgas.D.Ace (119)" },
      { slug: "op-op13-119_p1", externalId: "657408", title: "Portgas.D.Ace (119) (Parallel)" },
      { slug: "op-op13-119_p2", externalId: "657407", title: "Portgas.D.Ace (119) (Super Alternate Art)" },
      { slug: "op-op13-119_p3", externalId: "657406", title: "Portgas.D.Ace (119) (Red Super Alternate Art)" },
      { slug: "op-op13-119_p4", externalId: "657409", title: "Portgas.D.Ace (119) (Wanted Poster)" },
    ];

    for (const t of targetCards) {
      const cardRes = await pool.query(`SELECT id FROM cards WHERE slug = $1`, [t.slug]);
      const cardId = cardRes.rows[0]?.id;
      if (!cardId) continue;

      // Update mapping
      await pool.query(
        `
        INSERT INTO card_source_mapping (card_id, source, external_id, external_url, external_title, confidence, matched_by, updated_at)
        VALUES ($1, 'tcgplayer', $2, $3, $4, 'confirmed', 'manual', NOW())
        ON CONFLICT (card_id, source)
        DO UPDATE SET external_id = EXCLUDED.external_id,
                      external_url = EXCLUDED.external_url,
                      external_title = EXCLUDED.external_title,
                      confidence = 'confirmed',
                      matched_by = 'manual',
                      updated_at = NOW()
        `,
        [cardId, t.externalId, `https://www.tcgplayer.com/product/${t.externalId}`, t.title]
      );

      const result = await syncDualEngineSales(cardId, t.externalId);
      console.log(`[TARGET FIXED] ${t.slug} (Prod ${t.externalId}): Final $${result.finalPrice} (Sale: $${result.latestSalePrice}, History: $${result.latestHistoryPrice}, ${result.insertedHistoryCount} weekly points)`);
    }

    // 2. Scan all remaining cards with headline_cents > $1,000 for any listing trap
    const highCards = await pool.query(`
      SELECT c.id, c.slug, cp.headline_cents, csm.external_id
      FROM card_price_current cp
      JOIN cards c ON c.id = cp.card_id
      JOIN card_source_mapping csm ON c.id = csm.card_id AND csm.source = 'tcgplayer'
      WHERE c.slug LIKE 'op-%' AND c.slug NOT LIKE '%-ja'
        AND cp.headline_source = 'tcgplayer'
        AND cp.headline_cents >= 100000
    `);

    console.log(`Scanning ${highCards.rows.length} high-value cards for listing traps...`);
    for (const c of highCards.rows) {
      const res = await syncDualEngineSales(c.id, c.external_id);
      console.log(`[SCAN CHECK] ${c.slug}: Final $${res.finalPrice}`);
    }

    console.log("Dual-engine sync complete!");
    process.exit(0);
  }

  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
