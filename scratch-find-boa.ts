import { dbQuery } from './lib/db/client';

async function main() {
  const cards = await dbQuery(`
    SELECT slug, name, set_id
    FROM cards
    WHERE name ILIKE '%Boa%' AND name ILIKE '%Manga%'
  `);
  console.log(cards);
  
  const prb01 = await dbQuery(`
    SELECT slug, name 
    FROM cards 
    WHERE set_id = 'op-prb-01' AND name ILIKE '%Boa%'
  `);
  console.log("PRB01 Boa:", prb01);
  
  process.exit(0);
}
main();
