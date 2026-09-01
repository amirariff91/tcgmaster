import { dbQuery } from './lib/db/client';

async function main() {
  console.log("Adding snkrdunk_fetched and pc_fetched to cards...");
  
  try {
    await dbQuery(`ALTER TABLE cards ADD COLUMN snkrdunk_fetched BOOLEAN DEFAULT FALSE`);
    console.log("snkrdunk_fetched added");
  } catch (e: any) {
    console.log("snkrdunk_fetched error:", e.message);
  }

  try {
    await dbQuery(`ALTER TABLE cards ADD COLUMN pc_fetched BOOLEAN DEFAULT FALSE`);
    console.log("pc_fetched added");
  } catch (e: any) {
    console.log("pc_fetched error:", e.message);
  }
  
  process.exit(0);
}
main();
