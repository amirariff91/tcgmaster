import { dbQuery } from "../lib/db/client";

async function main() {
  const contaminated = await dbQuery<{
    id: string;
    card_id: string;
    price: number;
    source: string;
    source_url: string;
    recorded_at: string;
    card_slug: string;
    card_name: string;
  }>(`
    SELECT ph.id, ph.card_id, ph.price, ph.source, ph.recorded_at,
           c.slug as card_slug, c.name as card_name
    FROM price_history ph
    JOIN cards c ON ph.card_id = c.id
    WHERE c.slug LIKE 'op-%-ja'
      AND c.slug LIKE '%_p%'
      AND ph.source = 'pricecharting'
      AND ph.price < 25.00
      AND (
        c.name ILIKE '%[sp%' 
        OR c.name ILIKE '%special card%' 
        OR c.name ILIKE '%manga%'
        OR c.rarity ILIKE '%sp%'
        OR c.rarity ILIKE '%special%'
      )
  `);

  console.log(`Found ${contaminated.length} contaminated variant records with price < $25 on SP / Special cards.`);
  for (const row of contaminated.slice(0, 10)) {
    console.log(`- [${row.card_slug}] ${row.card_name}: $${row.price} recorded on ${row.recorded_at}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
