import { dbQuery } from '../lib/db/client';
import { selectHeadline, type PriceObservation } from '../lib/price-engine/write-path';

async function main() {
  const slug = 'op-op13-119_p3-ja';
  console.log(`[Re-Quarantine] Processing ${slug}...`);

  const cards = await dbQuery<any>(
    'SELECT id, name FROM cards WHERE slug = $1',
    [slug]
  );
  if (cards.length === 0) {
    console.error(`Card not found: ${slug}`);
    process.exit(1);
  }
  const card = cards[0];

  // 1. Move old history to quarantine
  console.log(`[Re-Quarantine] Moving corrupted history (before Aug 11) to price_quarantine...`);
  await dbQuery(`
    INSERT INTO price_quarantine (
       card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at
     )
     SELECT card_id, source, grade, price, price_native, currency, price_kind, $1, $2, recorded_at
     FROM price_history
     WHERE card_id = $3 AND recorded_at < '2026-08-11'
  `, ['manual-mapping-correction', JSON.stringify({ note: `Re-quarantined garbage history` }), card.id]);

  const deletedHistory = await dbQuery(`
    DELETE FROM price_history 
    WHERE card_id = $1 AND recorded_at < '2026-08-11'
    RETURNING id, source
  `, [card.id]);
  
  console.log(`[Re-Quarantine] -> Moved ${deletedHistory.length} corrupted rows to price_quarantine.`);

  // 2. Re-evaluate card_price_current
  console.log(`[Re-Quarantine] Recalculating card_price_current...`);
  
  // Wipe out the existing source_prices for pricecharting and snkrdunk that were pulled from the bad history
  const currentPrices = await dbQuery<any>(
    `SELECT source_prices, graded_prices FROM card_price_current WHERE card_id = $1`,
    [card.id]
  );

  if (currentPrices.length > 0) {
    const row = currentPrices[0];
    const sourcePrices = row.source_prices || {};
    const gradedPrices = row.graded_prices || {};
    
    // We will completely rebuild the current prices by finding the latest row in the remaining (clean) history
    const latestHistory = await dbQuery<any>(
      `SELECT source, price as priceUsd, price_native as priceNative, currency, grade, price_kind, recorded_at
       FROM (
         SELECT *, ROW_NUMBER() OVER(PARTITION BY source, grade ORDER BY recorded_at DESC) as rn
         FROM price_history
         WHERE card_id = $1
       ) t WHERE rn = 1`,
      [card.id]
    );

    const newSourcePrices: Record<string, any> = {};
    const newGradedPrices: Record<string, any> = {};

    const syntheticObservations = latestHistory.map(row => {
      const isGraded = row.grade !== 'raw';
      
      if (!isGraded) {
        newSourcePrices[row.source] = {
          usd: parseFloat(row.priceusd),
          native: row.pricenative ? parseFloat(row.pricenative) : null,
          currency: row.currency,
          kind: row.price_kind,
          recorded_at: row.recorded_at
        };
      } else {
        if (!newGradedPrices[row.grade]) newGradedPrices[row.grade] = { average: 0, sources: {} };
        newGradedPrices[row.grade].sources[row.source] = parseFloat(row.priceusd);
      }
      
      return {
        source: row.source,
        grade: row.grade,
        priceUsd: parseFloat(row.priceusd),
        priceNative: row.pricenative ? parseFloat(row.pricenative) : null,
        currency: row.currency,
        evidence: { externalUrl: '', matchedBy: 'cached-url' },
        recordedAt: row.recorded_at
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

    console.log(`[Re-Quarantine] New headline computed: ${headline_cents ? headline_cents / 100 : 'null'}`);

    await dbQuery(
      `UPDATE card_price_current 
       SET source_prices = $1, graded_prices = $2, headline_cents = $3, headline_source = $4, headline_kind = $5, headline_currency = $6, computed_at = NOW()
       WHERE card_id = $7`,
      [JSON.stringify(newSourcePrices), JSON.stringify(newGradedPrices), headline_cents, headline_source, headline_kind, headline_currency, card.id]
    );
  }

  console.log(`[Re-Quarantine] Successfully re-quarantined old history and cleaned chart!`);
  process.exit(0);
}

main().catch(console.error);
