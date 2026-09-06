import { dbQuery } from "../lib/db/client";

async function main() {
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
    'op-op16-073_p2-ja', 'op-op16-063_p2-ja', 'op-prb02-001_p2-ja'
  ];

  const cards = await dbQuery<any>(`
    SELECT c.slug, c.name, c.rarity, c.pricecharting_url, c.snkrdunk_url, c.curation_status,
           (SELECT COUNT(*) FROM price_history ph WHERE ph.card_id = c.id AND ph.source = 'pricecharting') as pc_ph_count,
           (SELECT COUNT(*) FROM price_history ph WHERE ph.card_id = c.id AND ph.source = 'snkrdunk') as snkr_ph_count,
           cpc.headline_cents, cpc.headline_source
    FROM cards c
    LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
    WHERE c.slug = ANY($1::text[])
    ORDER BY c.slug;
  `, [MANGA_SLUGS]);

  console.log(`\n========================================================================================================`);
  console.log(`COMPLETE AUDIT OF ALL JAPANESE MANGA CARDS (${cards.length} cards found in database)`);
  console.log(`========================================================================================================`);

  for (const c of cards) {
    const pcCount = String(c.pc_ph_count).padStart(3);
    const snkrCount = String(c.snkr_ph_count).padStart(3);
    const hl = c.headline_cents ? ("$" + (c.headline_cents/100).toFixed(2)).padStart(10) : "      NONE";
    const src = (c.headline_source || "none").padEnd(14);
    const status = (c.curation_status || "normal").padEnd(10);
    console.log(`${c.slug.padEnd(20)} | PC:${pcCount} | SNKR:${snkrCount} | HL:${hl} (${src}) | Status:${status} | URL: ${c.pricecharting_url || "NONE"}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
