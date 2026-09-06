import { dbQuery } from "../lib/db/client";

async function main() {
  const cards = await dbQuery<any>(`
    SELECT id, slug, name, rarity, pricecharting_url
    FROM cards
    WHERE slug IN (
      'op-op05-119_p1-ja', 'op-op05-119_p3-ja', 'op-op05-119_p5-ja', 'op-op05-119_p6-ja', 'op-op05-119_p7-ja', 'op-op05-119_p8-ja',
      'op-op01-016_p4-ja', 'op-op01-016_p5-ja',
      'op-op01-025_p4-ja',
      'op-op01-120_p4-ja', 'op-op01-120_p5-ja',
      'op-op02-013_p3-ja', 'op-op02-013_p5-ja',
      'op-op04-083_p3-ja', 'op-op04-083_p5-ja',
      'op-op06-118_p4-ja',
      'op-op07-051_p3-ja', 'op-op07-051_p4-ja',
      'op-op08-106_p3-ja', 'op-op08-106_p4-ja',
      'op-op09-093_p3-ja', 'op-op09-093_p4-ja',
      'op-op09-119_p3-ja',
      'op-eb01-003_p3-ja',
      'op-eb01-006_p4-ja', 'op-eb01-006_p5-ja'
    )
    ORDER BY slug;
  `);

  console.log(`Found ${cards.length} target SP cards:`);
  for (const c of cards) {
    console.log(`${c.slug.padEnd(20)} | ${c.name.padEnd(35)} | ${c.rarity.padEnd(12)} | ${c.pricecharting_url || 'NONE'}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
