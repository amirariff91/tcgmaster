import { dbQuery } from './lib/db/client';

async function main() {
  const badRows = await dbQuery(`
    SELECT id, price 
    FROM price_history 
    WHERE card_id = (SELECT id FROM cards WHERE slug = 'op-op06-118_p2-ja')
      AND source = 'snkrdunk'
      AND recorded_at >= '2026-08-14'
  `);
  
  for (const row of badRows) {
    await dbQuery(`DELETE FROM price_history WHERE id = $1`, [row.id]);
    console.log(`Deleted bad row ${row.id} for $${row.price}`);
  }

  process.exit(0);
}
main();
