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

/**
 * Ingests 1-year historical sales records from TCGPlayer's Infinite API
 * for a specific card product ID into `price_history`.
 */
export async function syncTcgplayer1YearSalesHistory(
  cardId: string,
  externalId: string | number,
  options: { updateCurrentHeadline?: boolean } = { updateCurrentHeadline: true }
): Promise<{ insertedPoints: number; latestPrice: number | null }> {
  const prodId = externalId.toString();

  const url = `https://infinite-api.tcgplayer.com/price/history/${prodId}?range=annual`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    console.warn(`[TCGPlayer 1Y] Failed to fetch product ${prodId}: HTTP ${res.status}`);
    return { insertedPoints: 0, latestPrice: null };
  }

  const data = await res.json();
  const results: InfiniteHistoryItem[] = data.result || [];

  if (results.length === 0) {
    return { insertedPoints: 0, latestPrice: null };
  }

  // Sort chronologically ascending
  results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let insertedCount = 0;
  let latestValidPrice: number | null = null;

  for (const item of results) {
    if (!item.variants || item.variants.length === 0) continue;

    // Prefer Foil if present (e.g. for One Piece cards / alt arts), otherwise take first variant
    const variant = item.variants.find((v) => v.variant === "Foil") || item.variants[0];
    const avgSale = parseFloat(variant.averageSalesPrice || "0");
    const market = parseFloat(variant.marketPrice || "0");

    // Guardrail: Completed average sale price takes top precedence, then market price.
    // Filter out fantasy asking outliers (> $80,000 without verified sales volume)
    const price = avgSale > 0 ? avgSale : market;

    if (price > 0 && price < 80000) {
      latestValidPrice = price;
      const recordedAt = `${item.date}T12:00:00Z`;

      // Upsert into price_history (prevent exact duplicate points for the same date)
      await pool.query(
        `
        INSERT INTO price_history (
          card_id, source, grade, price, price_native, currency, price_kind, recorded_at
        )
        VALUES ($1, 'tcgplayer', 'raw', $2, $2, 'USD', 'market', $3::timestamptz)
        ON CONFLICT DO NOTHING
        `,
        [cardId, price, recordedAt]
      );
      insertedCount++;
    }
  }

  if (options.updateCurrentHeadline && latestValidPrice !== null) {
    const headlineCents = Math.round(latestValidPrice * 100);

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
      [cardId, headlineCents, latestValidPrice]
    );

    await pool.query(`UPDATE cards SET price_cache_ttl = $1 WHERE id = $2`, [headlineCents, cardId]);
  }

  return { insertedPoints: insertedCount, latestPrice: latestValidPrice };
}

// CLI runner if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  async function runAll() {
    console.log("Starting batch 1-year TCGPlayer sales history backfill for English One Piece cards...");
    const cardsRes = await pool.query(`
      SELECT c.id, c.slug, csm.external_id
      FROM cards c
      JOIN card_source_mapping csm ON c.id = csm.card_id AND csm.source = 'tcgplayer'
      WHERE c.slug LIKE 'op-%' AND c.slug NOT LIKE '%-ja' AND csm.external_id IS NOT NULL
      ORDER BY c.slug;
    `);

    console.log(`Found ${cardsRes.rows.length} mapped cards to process.`);
    let processed = 0;

    for (const card of cardsRes.rows) {
      try {
        const { insertedPoints, latestPrice } = await syncTcgplayer1YearSalesHistory(
          card.id,
          card.external_id,
          { updateCurrentHeadline: true }
        );
        processed++;
        if (processed % 20 === 0 || insertedPoints > 0) {
          console.log(`[${processed}/${cardsRes.rows.length}] ${card.slug}: ${insertedPoints} points (Latest: $${latestPrice})`);
        }
      } catch (err: any) {
        console.error(`Error syncing ${card.slug}:`, err.message);
      }
    }

    console.log("Finished batch 1-year sales history ingestion!");
    process.exit(0);
  }

  runAll();
}
