import { dbQuery } from './lib/db/client';

const MANGA_SLUGS = [
  'op-op01-120_p2-ja', 'op-op01-120_r2-ja', 'op-op02-013_p2-ja', 'op-op02-013_r1-ja',
  'op-op03-122_p2-ja', 'op-op03-122_r1-ja', 'op-op04-083_p2-ja', 'op-op04-083_r1-ja',
  'op-op05-119_p2-ja', 'op-op05-119_r2-ja', 'op-op05-069_p2-ja', 'op-op05-069_r1-ja',
  'op-op05-074_p2-ja', 'op-op05-074_r2-ja', 'op-op06-118_p2-ja', 'op-eb01-006_p2-ja',
  'op-eb01-006_r1-ja', 'op-op07-051_p2-ja', 'op-op08-118_p2-ja', 'op-op09-119_p2-ja',
  'op-op09-093_p2-ja', 'op-op09-004_p2-ja', 'op-op09-051_p2-ja', 'op-op09-118_p2-ja',
  'op-op10-119_p2-ja', 'op-eb02-061_p2-ja', 'op-op11-118_p2-ja', 'op-op12-118_p2-ja',
  'op-op06-119_p3-ja', 'op-op13-119_p3-ja', 'op-op13-119_p1-ja', 'op-op13-120_p3-ja',
  'op-op13-120_p2-ja', 'op-op13-118_p3-ja', 'op-op13-118_p2-ja', 'op-op14-119_p2-ja',
  'op-op15-118_p2-ja', 'op-eb03-uta_p2-ja', 'op-eb04-koby_p2-ja', 'op-op16-065_p2-ja',
  'op-op16-073_p2-ja', 'op-op16-063_p2-ja'
];

async function main() {
  const cards = await dbQuery("SELECT id, slug, snkrdunk_fetched FROM cards WHERE slug = ANY($1::text[])", [MANGA_SLUGS]);
  
  console.log(`Found ${cards.length} manga cards in DB.`);
  
  for (const card of cards) {
    const prices = await dbQuery("SELECT count(*) as count FROM price_history WHERE card_id = $1 AND source = 'snkrdunk'", [card.id]);
    console.log(`${card.slug}: ${prices[0].count} trades. (snkrdunk_fetched=${card.snkrdunk_fetched})`);
  }
  
  process.exit(0);
}
main();
