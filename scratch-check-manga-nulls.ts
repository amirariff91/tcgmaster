import { dbQuery } from './lib/db/client';

async function main() {
  const MANGA_SLUGS = [
    'op-op01-120_p2-ja', 'op-op05-119_p2-ja', 'op-op06-118_p2-ja',
    'op-op07-119_p2-ja', 'op-op07-109_p2-ja', 'op-op08-119_p2-ja',
    'op-op08-119_p3-ja', 'op-op08-118_p2-ja', 'op-op08-069_p2-ja',
    'op-eb01-001_p2-ja', 'op-eb01-061_p2-ja', 'op-eb01-061_p3-ja',
    'op-st01-012_p1-ja', 'op-st01-012_p2-ja', 'op-st10-006_p1-ja',
    'op-st10-006_p2-ja', 'op-prb01-001_p1-ja', 'op-prb01-001_p2-ja',
    'op-op09-118_p2-ja', 'op-op09-093_p2-ja', 'op-op09-004_p2-ja', 'op-op09-051_p2-ja',
    'op-op09-119_p2-ja', 'op-op10-119_p2-ja', 'op-eb02-061_p2-ja', 'op-op11-118_p2-ja',
    'op-op12-118_p2-ja', 'op-op06-119_p3-ja', 'op-op13-119_p1-ja', 'op-op13-119_p3-ja',
    'op-op13-120_p2-ja', 'op-op13-120_p3-ja', 'op-op13-118_p2-ja', 'op-op13-118_p3-ja',
    'op-op14-119_p2-ja', 'op-op15-118_p2-ja', 'op-op16-063_p2-ja', 'op-op16-065_p2-ja',
    'op-op16-073_p2-ja'
  ];

  const nullSnkrdunk = await dbQuery(`
    SELECT slug
    FROM cards
    WHERE slug = ANY($1::text[])
      AND historical_fetched = FALSE
      AND snkrdunk_url IS NULL
  `, [MANGA_SLUGS]);

  console.log(`Manga cards with NULL snkrdunk_url AND unfetched: ${nullSnkrdunk.length}`);

  const nullPricecharting = await dbQuery(`
    SELECT slug
    FROM cards
    WHERE slug = ANY($1::text[])
      AND historical_fetched = FALSE
      AND pricecharting_url IS NULL
  `, [MANGA_SLUGS]);

  console.log(`Manga cards with NULL pricecharting_url AND unfetched: ${nullPricecharting.length}`);

  process.exit(0);
}
main();
