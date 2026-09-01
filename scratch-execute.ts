import { dbQuery } from './lib/db/client';

async function main() {
  const cardId = '1aa3b19e-7339-4c6a-b294-53d59317f3d3';

  // 1. Update Cards table
  await dbQuery(`
    UPDATE cards 
    SET snkrdunk_url = $1, 
        pricecharting_url = $2, 
        yuyutei_url = $3,
        curation_status = 'pending',
        last_price_fetch = null
    WHERE id = $4
  `, [
    'https://snkrdunk.com/en/trading-cards/159664?slide=right&query_id=1d219cb2-4a65-4c8f-9827-33d622a03269',
    'https://www.pricecharting.com/game/one-piece-japanese-wings-of-the-captain/roronoa-zoro-alternate-art-manga-op06-118',
    'https://yuyu-tei.jp/sell/opc/card/op06/10142',
    cardId
  ]);

  console.log('Cards table updated');

  // 2. Update Source Mappings (force it to manual & confirmed)
  const sources = [
    { source: 'snkrdunk', url: 'https://snkrdunk.com/en/trading-cards/159664?slide=right&query_id=1d219cb2-4a65-4c8f-9827-33d622a03269' },
    { source: 'pricecharting', url: 'https://www.pricecharting.com/game/one-piece-japanese-wings-of-the-captain/roronoa-zoro-alternate-art-manga-op06-118' },
    { source: 'yuyutei', url: 'https://yuyu-tei.jp/sell/opc/card/op06/10142' }
  ];

  for (const s of sources) {
    await dbQuery(`
      INSERT INTO card_source_mapping (
        card_id, source, external_url, confidence, matched_by, updated_at
      )
      VALUES ($1, $2, $3, 'confirmed', 'manual', NOW())
      ON CONFLICT (card_id, source) DO UPDATE SET
        external_url = EXCLUDED.external_url,
        confidence = EXCLUDED.confidence,
        matched_by = EXCLUDED.matched_by,
        updated_at = NOW()
    `, [cardId, s.source, s.url]);
  }
  
  console.log('Source mappings updated');

  // 3. Quarantine Migration
  await dbQuery(`
    INSERT INTO price_quarantine (
       card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at
     )
     SELECT card_id, source, grade, price, price_native, currency, price_kind, $1, $2, recorded_at
     FROM price_history
     WHERE card_id = $3
  `, ['manual-mapping-correction', JSON.stringify({ note: `Re-mapped to correct variant URLs` }), cardId]);

  const deletedHistory = await dbQuery(`
    DELETE FROM price_history 
    WHERE card_id = $1
    RETURNING id, source
  `, [cardId]);
  
  console.log(`[Re-Quarantine] -> Moved ${deletedHistory.length} corrupted rows to price_quarantine.`);

  // 4. Wipe cached current prices
  await dbQuery(`DELETE FROM card_price_current WHERE card_id = $1`, [cardId]);
  console.log('Cleared card_price_current');
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
