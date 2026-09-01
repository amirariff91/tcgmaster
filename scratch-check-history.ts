import { dbQuery } from './lib/db/client';

async function main() {
  const cardId = '1aa3b19e-7339-4c6a-b294-53d59317f3d3'; // Zoro manga
  
  const history = await dbQuery(`
    SELECT source, grade, count(*) as cnt, max(recorded_at) as latest
    FROM price_history
    WHERE card_id = $1 AND source = 'snkrdunk'
    GROUP BY source, grade
  `, [cardId]);
  
  console.table(history);
  process.exit(0);
}
main();
