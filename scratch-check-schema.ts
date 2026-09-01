import { dbQuery } from './lib/db/client';

async function main() {
  const res = await dbQuery("SELECT column_name FROM information_schema.columns WHERE table_name = 'cards'");
  console.log(res.map(r => r.column_name).join(', '));
  process.exit(0);
}
main();
