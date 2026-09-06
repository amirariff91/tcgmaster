import { dbQuery } from '../lib/db/client';
import { selectHeadline, type PriceObservation } from '../lib/price-engine/write-path';

/**
 * Reconcile card_price_current across all Japanese cards (or all cards)
 * Ensures card_price_current matches active rows in price_history.
 * Eliminates all "ghost" headlines where source data was quarantined.
 */
async function main() {
  console.log('Starting card_price_current reconciliation for Japanese cards...');

  // 1. Fetch all Japanese cards
  const cards = await dbQuery<{ id: string; slug: string }>(`
    SELECT id, slug
    FROM cards
    WHERE slug LIKE '%-ja'
    ORDER BY slug
  `);

  console.log(`Found ${cards.length} Japanese cards to reconcile.`);

  let resetCount = 0;
  let recomputedCount = 0;
  const batchSize = 100;

  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    const cardIds = batch.map(c => c.id);

    // Fetch latest price_history per source & grade for this batch
    const latestHistory = await dbQuery<{
      card_id: string;
      source: string;
      grade: string;
      price: string;
      price_native: string | null;
      currency: string;
      price_kind: string;
      recorded_at: Date;
    }>(`
      SELECT card_id, source, grade, price, price_native, currency, price_kind, recorded_at
      FROM (
        SELECT *, ROW_NUMBER() OVER(PARTITION BY card_id, source, grade ORDER BY recorded_at DESC) as rn
        FROM price_history
        WHERE card_id = ANY($1)
      ) t
      WHERE rn = 1
    `, [cardIds]);

    // Group by card_id
    const cardHistoryMap = new Map<string, typeof latestHistory>();
    for (const row of latestHistory) {
      const existing = cardHistoryMap.get(row.card_id) || [];
      existing.push(row);
      cardHistoryMap.set(row.card_id, existing);
    }

    for (const card of batch) {
      const historyRows = cardHistoryMap.get(card.id) || [];

      if (historyRows.length === 0) {
        // No valid history left -> Wipe card_price_current
        await dbQuery(`
          INSERT INTO card_price_current (
            card_id, source_prices, graded_prices, headline_cents, headline_source,
            headline_kind, headline_currency, headline_grade, computed_at
          )
          VALUES ($1, '{}'::jsonb, '{}'::jsonb, NULL, NULL, NULL, NULL, NULL, NOW())
          ON CONFLICT (card_id) DO UPDATE SET
            source_prices = '{}'::jsonb,
            graded_prices = '{}'::jsonb,
            headline_cents = NULL,
            headline_source = NULL,
            headline_kind = NULL,
            headline_currency = NULL,
            headline_grade = NULL,
            computed_at = NOW()
        `, [card.id]);
        resetCount++;
      } else {
        // Recompute from valid history rows
        const newSourcePrices: Record<string, any> = {};
        const newGradedPrices: Record<string, any> = {};

        const syntheticObservations = historyRows.map(row => {
          const isGraded = row.grade !== 'raw';
          const priceNum = parseFloat(row.price);

          if (!isGraded) {
            newSourcePrices[row.source] = {
              usd: priceNum,
              native: row.price_native ? parseFloat(row.price_native) : null,
              currency: row.currency,
              kind: row.price_kind,
              recorded_at: row.recorded_at.toISOString(),
            };
          } else {
            if (!newGradedPrices[row.grade]) {
              newGradedPrices[row.grade] = { average: 0, sources: {} };
            }
            newGradedPrices[row.grade].sources[row.source] = priceNum;
          }

          return {
            source: row.source,
            grade: row.grade,
            priceUsd: priceNum,
            priceNative: row.price_native ? parseFloat(row.price_native) : null,
            currency: row.currency,
            evidence: { externalUrl: '', matchedBy: 'reconciled-history' },
            recordedAt: row.recorded_at.toISOString(),
          };
        }) as PriceObservation[];

        // Calculate graded averages
        for (const grade of Object.keys(newGradedPrices)) {
          const values = Object.values(newGradedPrices[grade].sources) as number[];
          if (values.length > 0) {
            newGradedPrices[grade].average = values.reduce((a, b) => a + b, 0) / values.length;
          }
        }

        const headline = selectHeadline(syntheticObservations);

        const headline_cents = headline ? headline.cents : null;
        const headline_source = headline ? headline.source : null;
        const headline_kind = headline ? headline.kind : null;
        const headline_currency = headline ? 'USD' : null;
        const headline_grade = headline?.grade ?? 'raw';

        await dbQuery(`
          INSERT INTO card_price_current (
            card_id, source_prices, graded_prices, headline_cents, headline_source,
            headline_kind, headline_currency, headline_grade, computed_at
          )
          VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (card_id) DO UPDATE SET
            source_prices = EXCLUDED.source_prices,
            graded_prices = EXCLUDED.graded_prices,
            headline_cents = EXCLUDED.headline_cents,
            headline_source = EXCLUDED.headline_source,
            headline_kind = EXCLUDED.headline_kind,
            headline_currency = EXCLUDED.headline_currency,
            headline_grade = EXCLUDED.headline_grade,
            computed_at = NOW()
        `, [
          card.id,
          JSON.stringify(newSourcePrices),
          JSON.stringify(newGradedPrices),
          headline_cents,
          headline_source,
          headline_kind,
          headline_currency,
          headline_grade,
        ]);
        recomputedCount++;
      }
    }

    if ((i + batchSize) % 500 === 0 || i + batchSize >= cards.length) {
      console.log(`Processed ${Math.min(i + batchSize, cards.length)}/${cards.length} cards (Reset to empty: ${resetCount}, Recomputed: ${recomputedCount})...`);
    }
  }

  console.log(`\nReconciliation Complete!`);
  console.log(`- Total Japanese cards processed: ${cards.length}`);
  console.log(`- Reset empty cards (ghost prices purged): ${resetCount}`);
  console.log(`- Recomputed with authentic active history: ${recomputedCount}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Reconciliation failed:', err);
  process.exit(1);
});
