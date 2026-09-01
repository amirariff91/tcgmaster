import { dbQuery } from './lib/db/client';

async function main() {
  // Move the bad $132 Snkrdunk row to price_quarantine
  const badRows = await dbQuery(`
    SELECT id, card_id, price 
    FROM price_history 
    WHERE card_id = (SELECT id FROM cards WHERE slug = 'op-op06-118_p2-ja')
      AND source = 'snkrdunk'
      AND grade = 'raw'
      AND price = 132
  `);
  
  if (badRows.length > 0) {
    for (const row of badRows) {
      await dbQuery(`
        INSERT INTO price_quarantine (
          id, card_id, source, grade, grading_company_id, price, currency,
          recorded_at, reason, original_recorded_at
        )
        SELECT 
          id, card_id, source, grade, grading_company_id, price, currency,
          NOW(), 'puppeteer-DOM-leak-wrong-card', recorded_at
        FROM price_history
        WHERE id = $1
      `, [row.id]);
      
      await dbQuery(`DELETE FROM price_history WHERE id = $1`, [row.id]);
      console.log(`Quarantined bad row ${row.id} for $${row.price}`);
    }
  } else {
    console.log("No bad $132 rows found.");
  }

  process.exit(0);
}
main();
