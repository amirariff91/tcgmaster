import { dbQuery } from './lib/db/client';

async function main() {
  const cards = await dbQuery(`
    SELECT slug, snkrdunk_url, pricecharting_url, yuyutei_url
    FROM cards
    WHERE slug = 'op-op05-119_p2-ja'
  `);
  
  console.log(cards);
  process.exit(0);
}
main();
