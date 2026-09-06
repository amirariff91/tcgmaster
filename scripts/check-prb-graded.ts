import { dbQuery } from "../lib/db/client";

async function main() {
  const slugs = ['op-op05-069_r1-ja', 'op-eb01-006_r1-ja', 'op-op04-083_r1-ja', 'op-op05-074_r2-ja'];
  for (const slug of slugs) {
    const rows = await dbQuery<any>(`
      SELECT cpc.card_id, c.slug, cpc.headline_cents, cpc.headline_source, cpc.source_prices, cpc.graded_prices
      FROM card_price_current cpc
      JOIN cards c ON c.id = cpc.card_id
      WHERE c.slug = $1
    `, [slug]);
    console.log(`\n=== ${slug} ===`);
    if (rows.length > 0) {
      console.log('Graded prices:', JSON.stringify(rows[0].graded_prices, null, 2));
      console.log('Source prices:', JSON.stringify(rows[0].source_prices, null, 2));
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
