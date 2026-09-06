import { dbQuery } from "../lib/db/client";

async function main() {
  console.log("[Quarantine Cleaner] Finding contaminated variant price records...");

  // Select records where card is a variant (slug contains _p or name has special/sp/manga)
  // but price is absurdly low (< $15) and source is pricecharting
  const query = `
    SELECT ph.id, ph.card_id, ph.source, ph.grade, ph.price, ph.price_native, ph.currency, ph.price_kind, ph.recorded_at,
           c.slug, c.name
    FROM price_history ph
    JOIN cards c ON ph.card_id = c.id
    WHERE c.slug LIKE 'op-%-ja'
      AND c.slug LIKE '%_p%'
      AND ph.source = 'pricecharting'
      AND ph.price < 15.00
      AND (
        c.name ILIKE '%[sp%' 
        OR c.name ILIKE '%special card%' 
        OR c.name ILIKE '%manga%'
        OR c.rarity ILIKE '%sp%'
        OR c.rarity ILIKE '%special%'
      )
  `;

  const rows = await dbQuery<any>(query);
  console.log(`[Quarantine Cleaner] Found ${rows.length} rows to move to price_quarantine.`);

  if (rows.length === 0) {
    console.log("No contaminated rows found.");
    return;
  }

  // 1. Move to price_quarantine in batches
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const ids = batch.map(r => `'${r.id}'`).join(',');

    await dbQuery(`
      INSERT INTO price_quarantine (
        card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at
      )
      SELECT card_id, source, grade, price, price_native, currency, price_kind,
             'manual-mapping-correction',
             jsonb_build_object('note', 'Contaminated base card price on SP/Special variant', 'old_price', price),
             recorded_at
      FROM price_history
      WHERE id IN (${ids})
    `);

    await dbQuery(`
      DELETE FROM price_history
      WHERE id IN (${ids})
    `);

    console.log(`[Quarantine Cleaner] Processed batch ${i + 1} to ${Math.min(i + batchSize, rows.length)}`);
  }

  console.log(`[Quarantine Cleaner] Successfully moved ${rows.length} contaminated records to price_quarantine.`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
