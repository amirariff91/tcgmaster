import { dbQuery } from './lib/db/client';

async function main() {
  const schema = await dbQuery(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'price_quarantine'
  `);
  console.log(schema);
  process.exit(0);
}
main();
