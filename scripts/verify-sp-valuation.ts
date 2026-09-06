import { dbQuery } from "../lib/db/client";

async function main() {
  const slugs = [
    'op-op05-119_p1-ja',
    'op-op05-119_p3-ja',
  ];

  for (const slug of slugs) {
    const cards = await dbQuery<any>('SELECT id, slug, name, pricecharting_url FROM cards WHERE slug = $1', [slug]);
    if (cards.length === 0) continue;
    const card = cards[0];

    const prices = await dbQuery<any>(`
      SELECT price, grade, recorded_at
      FROM price_history
      WHERE card_id = $1 AND source = 'pricecharting'
      ORDER BY recorded_at DESC
    `, [card.id]);

    const current = await dbQuery<any>(`
      SELECT headline_cents, headline_source, headline_grade, source_prices, graded_prices
      FROM card_price_current
      WHERE card_id = $1
    `, [card.id]);

    console.log(`\n======================================================`);
    console.log(`Card: ${card.name} (${card.slug})`);
    console.log(`PriceCharting URL: ${card.pricecharting_url}`);
    console.log(`Historical Trades: ${prices.length} sales recorded`);
    if (prices.length > 0) {
      console.log(`Latest 3 completed trades:`);
      for (const p of prices.slice(0, 3)) {
        console.log(`  - Grade ${p.grade}: $${p.price} on ${new Date(p.recorded_at).toLocaleDateString()}`);
      }
    }
    console.log(`Current Valuation:`);
    if (current.length > 0) {
      const c = current[0];
      console.log(`  Headline: $${(c.headline_cents / 100).toFixed(2)} (${c.headline_source})`);
      console.log(`  Source Prices:`, JSON.stringify(c.source_prices));
      console.log(`  Graded Prices:`, JSON.stringify(c.graded_prices));
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
