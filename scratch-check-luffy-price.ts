import { dbQuery } from './lib/db/client';

async function main() {
  const prices = await dbQuery(`
    SELECT source, grade, price, recorded_at 
    FROM price_history 
    WHERE card_id = (SELECT id FROM cards WHERE slug = 'op-op05-119_p2-ja') 
      AND source = 'pricecharting'
    ORDER BY recorded_at DESC 
    LIMIT 5
  `);
  console.log('Latest PriceCharting trades for Manga Luffy OP05:', prices);
  process.exit(0);
}
main();
