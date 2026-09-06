import { dbQuery } from '../lib/db/client';
import 'dotenv/config';

async function checkAnomalies() {
  const rows = await dbQuery(`
    SELECT id, card_id, source, price, recorded_at, grade 
    FROM price_history 
    WHERE card_id IN (
      SELECT id FROM cards WHERE slug IN ('op-op05-069_r1-ja', 'op-eb01-006_r1-ja')
    ) AND price < 30
  `);
  console.log("Anomalies found:", rows.length);
  for (const r of rows) {
    console.log(r);
  }
}
checkAnomalies().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
