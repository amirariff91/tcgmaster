import { dbQuery } from "../lib/db/client";

async function run() {
  const cards = await dbQuery<any>(`
    SELECT c.slug, c.name, c.pricecharting_url, c.snkrdunk_url, c.yuyutei_url,
           (SELECT COUNT(*) FROM price_history ph WHERE ph.card_id = c.id AND ph.source = 'pricecharting') as pc_ph,
           (SELECT COUNT(*) FROM price_history ph WHERE ph.card_id = c.id AND ph.source = 'snkrdunk') as snkr_ph,
           (SELECT COUNT(*) FROM price_history ph WHERE ph.card_id = c.id AND ph.source = 'yuyutei') as yyt_ph,
           cpc.headline_cents, cpc.headline_source
    FROM cards c
    LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
    WHERE c.slug IN (
      'op-op05-119_p1-ja', 'op-op05-119_p3-ja', 'op-op05-119_p5-ja', 'op-op05-119_p6-ja',
      'op-op01-016_p4-ja', 'op-op01-025_p4-ja', 'op-op01-120_p4-ja',
      'op-op02-013_p3-ja', 'op-op04-083_p3-ja', 'op-op06-118_p4-ja',
      'op-op07-051_p3-ja', 'op-op08-106_p3-ja', 'op-op09-093_p3-ja',
      'op-op09-119_p3-ja', 'op-eb01-003_p3-ja', 'op-eb01-006_p4-ja', 'op-eb01-057_p2-ja'
    )
    ORDER BY c.slug;
  `);
  console.log(JSON.stringify(cards, null, 2));
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
