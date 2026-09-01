import { dbQuery } from './lib/db/client';

async function main() {
  const cards = await dbQuery("SELECT slug, name FROM cards WHERE slug LIKE 'op-op13%' OR slug LIKE 'op-op14%' OR slug LIKE 'op-op15%' OR slug LIKE 'op-op16%'");
  console.log('Weird cards:', cards);
  process.exit(0);
}
main();
