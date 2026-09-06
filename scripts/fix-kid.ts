import { dbQuery } from '../lib/db/client';
import 'dotenv/config';

async function fixKid() {
  const card = await dbQuery<{ id: string }>("SELECT id FROM cards WHERE slug = 'op-op05-074_r2-ja'");
  const cardId = card[0].id;
  
  await dbQuery(`
    INSERT INTO price_quarantine (card_id, source, grade, price, price_native, currency, price_kind, reason, evidence)
    SELECT card_id, source::price_source, grade, price, price_native, currency, COALESCE(price_kind::price_kind, 'sold_guide'::price_kind), 'manual-mapping-correction', '{"note": "Kid PRB01 contaminated base card prices"}'::jsonb
    FROM price_history
    WHERE card_id = $1 AND source = 'pricecharting'
  `, [cardId]);
  
  await dbQuery("DELETE FROM price_history WHERE card_id = $1 AND source = 'pricecharting'", [cardId]);
  
  await dbQuery("UPDATE cards SET pricecharting_url = $1, pc_fetched = FALSE WHERE id = $2", [
    'https://www.pricecharting.com/game/one-piece-premium-booster/eustasscaptainkid-manga-prb01-op05-074',
    cardId
  ]);
  
  console.log("Cleaned and updated Kid PRB01 URL.");
}
fixKid().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
