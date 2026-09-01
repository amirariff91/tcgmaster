import { dbQuery } from '../lib/db/client';

async function main() {
  console.log('[Restore-Quarantine] Restoring manual-mapping-correction for OP TCG...');

  // Find the quarantined rows for OP cards
  const quarantineRows = await dbQuery<any>(`
    SELECT q.*, c.slug 
    FROM price_quarantine q
    JOIN cards c ON q.card_id = c.id
    WHERE q.reason = 'manual-mapping-correction'
      AND c.slug LIKE 'op-%'
  `);

  if (quarantineRows.length === 0) {
    console.log('[Restore-Quarantine] No rows found to restore.');
    process.exit(0);
  }

  console.log(`[Restore-Quarantine] Found ${quarantineRows.length} rows to restore.`);

  let restoredCount = 0;

  for (const row of quarantineRows) {
    try {
      // Restore to price_history
      await dbQuery(`
        INSERT INTO price_history (
          card_id, price, source, grade, price_native, currency, price_kind, recorded_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
        ON CONFLICT DO NOTHING
      `, [
        row.card_id,
        row.price,
        row.source,
        row.grade,
        row.price_native,
        row.currency,
        row.price_kind,
        row.observed_at // Map observed_at back to recorded_at
      ]);

      // Remove from quarantine
      await dbQuery(`
        DELETE FROM price_quarantine WHERE id = $1
      `, [row.id]);

      restoredCount++;
    } catch (err) {
      console.error(`Failed to restore row ${row.id}:`, err);
    }
  }

  console.log(`[Restore-Quarantine] Successfully restored ${restoredCount} rows to price_history!`);
  process.exit(0);
}

main().catch(console.error);
