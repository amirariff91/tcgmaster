import { dbQuery } from './lib/db/client';

async function main() {
  const MANGA_SLUGS = [
    'op-op01-120_p2-ja', 'op-op01-120_r2-ja', 'op-op02-013_r1-ja', 'op-op02-013_p2-ja',
    'op-op03-122_r1-ja', 'op-op03-122_p2-ja', 'op-op04-083_p2-ja', 'op-op04-083_r1-ja',
    'op-op05-119_p2-ja', 'op-op05-119_r2-ja', 'op-op05-069_r1-ja', 'op-op05-069_p2-ja',
    'op-op05-074_r2-ja', 'op-op05-074_p2-ja', 'op-op06-118_p2-ja', 'op-op06-118_r1-ja',
    'op-eb01-006_r1-ja', 'op-eb01-006_p2-ja', 'op-op07-051_p2-ja', 'op-op08-118_p2-ja',
    'op-op09-118_p2-ja', 'op-op09-093_p2-ja', 'op-op09-004_p2-ja', 'op-op09-051_p2-ja',
    'op-op09-119_p2-ja', 'op-op10-119_p2-ja', 'op-eb02-061_p2-ja', 'op-op11-118_p2-ja',
    'op-op12-118_p2-ja', 'op-op06-119_p3-ja', 'op-op13-119_p1-ja', 'op-op13-119_p3-ja',
    'op-op13-120_p2-ja', 'op-op13-120_p3-ja', 'op-op13-118_p2-ja', 'op-op13-118_p3-ja',
    'op-op14-119_p2-ja', 'op-op15-118_p2-ja', 'op-op16-063_p2-ja', 'op-op16-065_p2-ja',
    'op-op16-073_p2-ja'
  ];

  console.log(`Resetting historical_fetched to FALSE for ${MANGA_SLUGS.length} manga cards...`);
  
  const result = await dbQuery(`
    UPDATE cards
    SET historical_fetched = FALSE,
        last_price_fetch = null
    WHERE slug = ANY($1::text[])
    RETURNING slug
  `, [MANGA_SLUGS]);

  console.log(`Successfully reset ${result.length} manga cards in the database.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
