import { dbQuery } from './lib/db/client.ts';
async function main() {
  const result = await dbQuery("SELECT 1 as num");
  console.log("DB connection successful:", result);
  process.exit(0);
}
main();
