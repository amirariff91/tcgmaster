import { dbQuery } from '../lib/db/client';
import 'dotenv/config';

async function quarantineAnomalies() {
  console.log("Moving the 2 PRB01 Manga Yuyutei anomalies to price_quarantine...");

  const res = await dbQuery(`
    WITH moved_rows AS (
      DELETE FROM price_history
      WHERE id IN ('0cc64ad8-d8da-4e4e-8441-1b6f2f9477b5', '64921ab3-61cf-42ee-9dde-ec957d607691')
      RETURNING *
    )
    INSERT INTO price_quarantine (
      card_id, source, grade, price, price_native, currency, price_kind, reason, evidence
    )
    SELECT 
      card_id, 
      source::price_source, 
      grade, 
      price, 
      price_native, 
      currency, 
      COALESCE(price_kind::price_kind, 'retail_sell'::price_kind), 
      'manual-mapping-correction', 
      jsonb_build_object('note', 'Legacy Yuyutei base card price scraped against PRB01 Manga reprint in July 2026', 'original_id', id, 'original_recorded_at', recorded_at)
    FROM moved_rows
    RETURNING card_id, price;
  `);

  console.log(`Successfully quarantined ${res.length} rows.`);
  for (const r of res) {
    console.log(`- Card ID ${r.card_id} quarantined price: $${r.price}`);
  }
}

quarantineAnomalies().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
