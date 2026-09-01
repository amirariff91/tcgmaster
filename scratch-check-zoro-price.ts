import { dbQuery } from './lib/db/client';

async function main() {
  const cardIdRows = await dbQuery("SELECT id FROM cards WHERE slug = 'op-op06-118_p2-ja'");
  const cardId = cardIdRows[0].id;
  
  const current = await dbQuery("SELECT * FROM card_price_current WHERE card_id = $1", [cardId]);
  console.log("Current Price Record:");
  console.log(JSON.stringify(current, null, 2));
  
  const snkrdunkRecent = await dbQuery("SELECT * FROM price_history WHERE card_id = $1 AND source = 'snkrdunk' ORDER BY recorded_at DESC LIMIT 5", [cardId]);
  console.log("\nRecent Snkrdunk History:");
  console.log(JSON.stringify(snkrdunkRecent, null, 2));

  process.exit(0);
}
main();
