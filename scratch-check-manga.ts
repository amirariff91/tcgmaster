import { dbQuery } from './lib/db/client';

async function main() {
  const MANGA_SLUGS = [
    'op-op01-120_p2-ja', 'op-op05-119_p2-ja', 'op-op06-118_p2-ja'
  ];
  
  const history = await dbQuery(`
    SELECT c.slug, p.source, p.grade, count(*) as cnt
    FROM price_history p
    JOIN cards c ON p.card_id = c.id
    WHERE c.slug = ANY($1::text[]) AND p.source = 'snkrdunk'
    GROUP BY c.slug, p.source, p.grade
    ORDER BY c.slug, p.grade
  `, [MANGA_SLUGS]);
  
  console.table(history);
  process.exit(0);
}
main();
