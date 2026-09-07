import { dbQuery } from "@/lib/db/client";

async function main() {
  console.log("=== STEP 1: Identifying Corrupted English One Piece PriceCharting Mappings ===");

  // Find corrupted cards:
  // 1. Variant cards (_p or _r) whose mapped PriceCharting URL does NOT contain variant keywords
  // 2. Base cards (no _p / _r) whose mapped PriceCharting URL contains variant keywords (except false positives like special-muggy-ball)
  const corruptedCards = await dbQuery<{
    id: string;
    slug: string;
    name: string;
    number: string;
    url: string;
  }>(`
    SELECT c.id, c.slug, c.name, c.number, csm.external_url as url
    FROM cards c
    JOIN card_source_mapping csm ON csm.card_id = c.id AND csm.source = 'pricecharting'
    WHERE c.slug LIKE 'op-%' AND c.slug NOT LIKE '%-ja'
      AND (
        (c.slug ~ '_(p|r)[0-9]+' AND csm.external_url !~* '(parallel|alternate-art|manga|-sp-|special|wanted|serial|anniversary|winner|tournament|flagship|promo)')
        OR
        (c.slug !~ '_(p|r)[0-9]+' AND csm.external_url ~* '(parallel|alternate-art|manga|-sp-|special|wanted|serial)' AND csm.external_url !~* 'special-muggy-ball|special-long-range-attack')
      )
  `);

  console.log(`Found ${corruptedCards.length} corrupted English One Piece cards mapped to PriceCharting.`);

  if (corruptedCards.length === 0) {
    console.log("No corrupted cards found. Exiting.");
    process.exit(0);
  }

  const cardIds = corruptedCards.map(c => c.id);

  // Check how many price_history records will be quarantined
  const historyCountRes = await dbQuery<{ count: string }>(`
    SELECT count(*) as count
    FROM price_history
    WHERE source = 'pricecharting'
      AND card_id = ANY($1)
  `, [cardIds]);
  const historyCount = parseInt(historyCountRes[0].count, 10);
  console.log(`Found ${historyCount} price_history records to migrate to price_quarantine.`);

  // Step 2: Quarantine Migration (Pattern 10)
  console.log("\n=== STEP 2: Executing Zero-Data-Loss Quarantine Migration ===");

  const insertQuarantineRes = await dbQuery(`
    INSERT INTO price_quarantine (
      card_id, source, grade, price, price_native, currency, price_kind,
      reason, evidence, observed_at, resolved_at, resolution
    )
    SELECT 
      ph.card_id,
      ph.source,
      ph.grade,
      ph.price,
      ph.price_native,
      ph.currency,
      ph.price_kind,
      'manual-mapping-correction' as reason,
      json_build_object(
        'detail', 'english-op-pc-mismatch-correction',
        'migrated_from', 'price_history',
        'sale_type', ph.sale_type,
        'confidence', ph.confidence,
        'recorded_at', ph.recorded_at,
        'previous_url', csm.external_url
      )::jsonb as evidence,
      ph.recorded_at as observed_at,
      NULL::timestamptz as resolved_at,
      NULL::text as resolution
    FROM price_history ph
    JOIN card_source_mapping csm ON csm.card_id = ph.card_id AND csm.source = 'pricecharting'
    WHERE ph.source = 'pricecharting'
      AND ph.card_id = ANY($1)
  `, [cardIds]);

  console.log(`✓ Migrated ${historyCount} records into price_quarantine.`);

  // Delete from price_history now that all records are preserved in price_quarantine
  const deleteHistoryRes = await dbQuery(`
    DELETE FROM price_history
    WHERE source = 'pricecharting'
      AND card_id = ANY($1)
  `, [cardIds]);

  console.log(`✓ Purged ${historyCount} corrupted records from price_history.`);

  // Step 3: Delete invalid mappings from card_source_mapping
  console.log("\n=== STEP 3: Removing Invalid PriceCharting Mappings from card_source_mapping ===");
  await dbQuery(`
    DELETE FROM card_source_mapping
    WHERE source = 'pricecharting'
      AND card_id = ANY($1)
  `, [cardIds]);
  console.log(`✓ Removed PriceCharting mapping for all ${corruptedCards.length} cards.`);

  // Step 4: Refresh card_price_current for affected cards
  console.log("\n=== STEP 4: Scrubbing Stale PriceCharting from card_price_current ===");
  // If a card has pricecharting in its source_prices or graded_prices, remove it
  await dbQuery(`
    UPDATE card_price_current
    SET 
      source_prices = source_prices - 'pricecharting',
      computed_at = NOW()
    WHERE card_id = ANY($1)
      AND source_prices ? 'pricecharting'
  `, [cardIds]);
  console.log(`✓ Cleaned card_price_current source_prices for affected cards.`);

  console.log("\n=== Quarantining and Cleanup Finished Successfully! ===");
}

main().then(() => process.exit(0)).catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
