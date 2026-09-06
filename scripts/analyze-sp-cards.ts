import { dbQuery } from "../lib/db/client";

async function main() {
  const cards = await dbQuery<any>(`
    SELECT id, slug, name, rarity, pricecharting_url,
           (SELECT COUNT(*) FROM price_history ph WHERE ph.card_id = cards.id AND ph.source = 'pricecharting') as pc_count
    FROM cards
    WHERE slug LIKE 'op-%-ja'
      AND (
        rarity ILIKE '%sp%'
        OR rarity ILIKE '%special%'
        OR name ILIKE '%[sp%'
        OR name ILIKE '%special card%'
        OR slug LIKE '%_p3%'
        OR slug LIKE '%_p4%'
        OR slug LIKE '%_p5%'
      )
      AND (curation_status != 'manga' OR curation_status IS NULL)
    ORDER BY slug
  `);

  console.log(`Total Japanese SP / Special variant cards: ${cards.length}`);
  const unmapped = cards.filter(c => !c.pricecharting_url);
  const mapped = cards.filter(c => !!c.pricecharting_url);
  console.log(`- Mapped with PriceCharting URL: ${mapped.length}`);
  console.log(`- Unmapped (Missing URL): ${unmapped.length}`);

  console.log("\nTop 15 Unmapped SP cards:");
  for (const c of unmapped.slice(0, 15)) {
    console.log(`  ${c.slug} | ${c.name} | Rarity: ${c.rarity} | PC count: ${c.pc_count}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
