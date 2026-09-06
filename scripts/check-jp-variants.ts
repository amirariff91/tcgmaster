import { dbQuery } from "../lib/db/client";

async function main() {
  const rows = await dbQuery<any>(`
    SELECT c.slug, c.name, c.rarity, c.pricecharting_url,
           (SELECT COUNT(*) FROM price_history ph WHERE ph.card_id = c.id) as ph_count,
           (SELECT COUNT(*) FROM price_history ph WHERE ph.card_id = c.id AND ph.source = 'pricecharting') as pc_ph_count
    FROM cards c
    WHERE c.slug LIKE 'op-%-ja'
      AND (
        c.slug ILIKE '%op05-119%' 
        OR c.slug ILIKE '%op01-120%'
        OR c.slug ILIKE '%op01-016%'
        OR c.slug ILIKE '%op01-025%'
        OR c.slug ILIKE '%op02-013%'
        OR c.slug ILIKE '%op04-083%'
        OR c.slug ILIKE '%op06-118%'
        OR c.slug ILIKE '%op06-119%'
        OR c.slug ILIKE '%op07-051%'
        OR c.slug ILIKE '%op08-118%'
        OR c.slug ILIKE '%op09-093%'
        OR c.slug ILIKE '%op09-119%'
      )
    ORDER BY c.slug;
  `);

  console.log(`Found ${rows.length} flagship Japanese variants:`);
  for (const r of rows) {
    console.log(`${r.slug.padEnd(20)} | ${r.name.padEnd(35)} | ${(r.rarity || '').padEnd(12)} | PC: ${String(r.pc_ph_count).padStart(3)} | ${r.pricecharting_url || 'NONE'}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
