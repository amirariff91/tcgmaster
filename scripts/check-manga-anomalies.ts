import { dbQuery } from "../lib/db/client";

async function main() {
  const slugs = [
    'op-op09-004_p2-ja', 'op-op09-051_p2-ja', 'op-op09-093_p2-ja', 'op-op09-118_p2-ja', 'op-op09-119_p2-ja',
    'op-op10-119_p2-ja', 'op-op11-118_p2-ja', 'op-op13-118_p2-ja', 'op-op13-120_p2-ja', 'op-op16-065_p2-ja',
    'op-op03-122_r1-ja', 'op-op04-083_r1-ja', 'op-op05-074_r2-ja',
    'op-op05-069_r1-ja', 'op-eb01-006_r1-ja'
  ];
  for (const slug of slugs) {
    const cards = await dbQuery<any>(`
      SELECT c.slug, c.name, c.pricecharting_url, c.snkrdunk_url,
             (SELECT COUNT(*) FROM price_history ph WHERE ph.card_id = c.id AND ph.source = 'pricecharting') as pc_ph_count,
             (SELECT COUNT(*) FROM price_history ph WHERE ph.card_id = c.id AND ph.source = 'snkrdunk') as snkr_ph_count,
             cpc.headline_cents, cpc.headline_source
      FROM cards c
      LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
      WHERE c.slug = $1
    `, [slug]);
    if (cards.length > 0) {
      const c = cards[0];
      const hl = c.headline_cents ? `$${(c.headline_cents/100).toFixed(2)}` : 'NONE';
      console.log(`${c.slug.padEnd(20)} | PC:${c.pc_ph_count} | SNKR:${c.snkr_ph_count} | HL:${hl} (${c.headline_source}) | URL: ${c.pricecharting_url}`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
