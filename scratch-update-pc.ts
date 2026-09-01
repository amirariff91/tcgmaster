import { dbQuery } from './lib/db/client';

async function main() {
  const slug = process.argv[2];
  const url = process.argv[3];
  
  if (!slug || !url) {
    console.error('Usage: tsx scratch-update-pc.ts <slug> <url>');
    process.exit(1);
  }

  const cards = await dbQuery("SELECT id, slug, name, pricecharting_url FROM cards WHERE slug = $1", [slug]);
  if (cards.length === 0) {
    console.error(`Card not found: ${slug}`);
    process.exit(1);
  }
  const card = cards[0];

  console.log(`Updating ${card.slug} (${card.name})`);
  console.log(`Old URL: ${card.pricecharting_url}`);
  console.log(`New URL: ${url}`);

  await dbQuery(`
    INSERT INTO price_quarantine (card_id, source, grade, price, currency, observed_at, reason, evidence, price_kind)
    SELECT card_id, source, grade, price, currency, recorded_at, 'manual-mapping-correction', '{}'::jsonb, 'retail_sell'
    FROM price_history
    WHERE card_id = $1 AND source = 'pricecharting'
  `, [card.id]);
  
  const delRes = await dbQuery(`
    DELETE FROM price_history
    WHERE card_id = $1 AND source = 'pricecharting'
    RETURNING id
  `, [card.id]);
  console.log(`Quarantined ${delRes.length} old PriceCharting trades.`);

  await dbQuery(`
    UPDATE cards 
    SET pricecharting_url = $1, pc_fetched = FALSE
    WHERE id = $2
  `, [url, card.id]);
  
  console.log(`Successfully updated mapping for ${card.slug}. Worker will pick it up momentarily.`);
  process.exit(0);
}

main();
