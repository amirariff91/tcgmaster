import { dbQuery } from '../lib/db/client';
import { selectHeadline, type PriceObservation } from '../lib/price-engine/write-path';

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error('Usage: bun run scripts/fix-mapping.ts <card_slug> <source> <new_url>');
    process.exit(1);
  }

  const [slug, source, newUrl] = args;
  console.log(`[Fix-Mapping] Processing ${slug} for ${source}...`);

  // 1. Get the card
  const cards = await dbQuery<any>(
    'SELECT id, name FROM cards WHERE slug = $1',
    [slug]
  );
  if (cards.length === 0) {
    console.error(`Card not found: ${slug}`);
    process.exit(1);
  }
  const card = cards[0];

  // 2. Update mapping
  const urlColumnMap: Record<string, string> = {
    'tcgplayer': 'tcgplayer_url',
    'snkrdunk': 'snkrdunk_url',
    'yuyutei': 'yuyutei_url',
    'pricecharting': 'pricecharting_url',
    'cardmarket': 'cardmarket_url'
  };

  const column = urlColumnMap[source];
  if (!column) {
    console.error(`Invalid source: ${source}`);
    process.exit(1);
  }

  console.log(`[Fix-Mapping] 1. Updating ${column} and card_source_mapping to ${newUrl}...`);
  await dbQuery(`UPDATE cards SET ${column} = $1, updated_at = NOW() WHERE id = $2`, [newUrl, card.id]);
  
  await dbQuery(
    `INSERT INTO card_source_mapping (card_id, source, external_url, confidence, matched_by, updated_at)
     VALUES ($1, $2, $3, 'confirmed', 'manual', NOW())
     ON CONFLICT (card_id, source) DO UPDATE SET 
       external_url = EXCLUDED.external_url, 
       confidence = 'confirmed',
       matched_by = 'manual',
       updated_at = NOW()`,
    [card.id, source, newUrl]
  );

  // 3. Quarantine Migration (Charts/History)
  console.log(`[Fix-Mapping] 2. Performing Quarantine Migration for ${source} history...`);
  // Move to quarantine
  await dbQuery(
    `INSERT INTO price_quarantine (
       card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at
     )
     SELECT card_id, source, grade, price, price_native, currency, price_kind, $1, $2, recorded_at
     FROM price_history
     WHERE card_id = $3 AND source = $4`,
    ['manual-mapping-correction', JSON.stringify({ note: `Moved due to mapping correction to ${newUrl}` }), card.id, source]
  );
  // Delete from history
  const deletedHistory = await dbQuery(
    `DELETE FROM price_history WHERE card_id = $1 AND source = $2 RETURNING id`,
    [card.id, source]
  );
  console.log(`[Fix-Mapping] -> Moved ${deletedHistory.length} corrupted rows to price_quarantine.`);

  // 4. Current Source Wipe & Headline Recalculation
  console.log(`[Fix-Mapping] 3. Wiping current source and recalculating headline...`);
  
  // Get current state
  const currentPrices = await dbQuery<any>(
    `SELECT source_prices, graded_prices FROM card_price_current WHERE card_id = $1`,
    [card.id]
  );

  if (currentPrices.length > 0) {
    const row = currentPrices[0];
    const sourcePrices = row.source_prices || {};
    const gradedPrices = row.graded_prices || {};
    
    if (sourcePrices[source]) {
      delete sourcePrices[source];
      console.log(`[Fix-Mapping] -> Deleted ${source} from source_prices.`);
    }

    let deletedGraded = 0;
    for (const grade of Object.keys(gradedPrices)) {
      if (gradedPrices[grade]?.sources && gradedPrices[grade].sources[source]) {
        delete gradedPrices[grade].sources[source];
        deletedGraded++;
        // Recalculate average
        const values = Object.values(gradedPrices[grade].sources) as number[];
        if (values.length > 0) {
          gradedPrices[grade].average = values.reduce((a, b) => a + b, 0) / values.length;
        } else {
          delete gradedPrices[grade];
        }
      }
    }
    if (deletedGraded > 0) {
      console.log(`[Fix-Mapping] -> Deleted ${source} from ${deletedGraded} graded_prices.`);
    }

    // Recompute headline
    // To use selectHeadline, we need to mock observations from the remaining source_prices.
    const latestHistory = await dbQuery<any>(
      `SELECT source, price as priceUsd, price_native as priceNative, currency, grade, price_kind
       FROM (
         SELECT *, ROW_NUMBER() OVER(PARTITION BY source, grade ORDER BY recorded_at DESC) as rn
         FROM price_history
         WHERE card_id = $1
       ) t WHERE rn = 1`,
      [card.id]
    );

    const syntheticObservations = latestHistory.map(row => ({
       source: row.source,
       grade: row.grade,
       priceUsd: parseFloat(row.priceusd),
       priceNative: row.pricenative ? parseFloat(row.pricenative) : null,
       currency: row.currency,
       evidence: { externalUrl: '', matchedBy: 'cached-url' },
       recordedAt: new Date().toISOString()
    })) as PriceObservation[];

    const headline = selectHeadline(syntheticObservations);
    
    const headline_cents = headline ? headline.cents : null;
    const headline_source = headline ? headline.source : null;
    const headline_kind = headline ? headline.kind : null;
    const headline_currency = headline ? 'USD' : null;

    console.log(`[Fix-Mapping] 4. New headline computed: ${headline_cents ? headline_cents / 100 : 'null'}`);

    await dbQuery(
      `UPDATE card_price_current 
       SET source_prices = $1, graded_prices = $2, headline_cents = $3, headline_source = $4, headline_kind = $5, headline_currency = $6, computed_at = NOW()
       WHERE card_id = $7`,
      [JSON.stringify(sourcePrices), JSON.stringify(gradedPrices), headline_cents, headline_source, headline_kind, headline_currency, card.id]
    );
  }

  // 5. Trigger Re-Scrape
  console.log(`[Fix-Mapping] 5. Done! The scraper will automatically pick up the new URL on its next run.`);
  console.log(`[Fix-Mapping] Successfully flushed & replaced ${slug}.`);
  process.exit(0);
}

main().catch(console.error);
