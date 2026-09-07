import { dbQuery } from '../lib/db/client';

async function findEvolvingSkies() {
  const sets = await dbQuery<{ id: string; name: string; slug: string }>(`
    SELECT id, name, slug
    FROM sets
    WHERE name ILIKE '%evolving skies%' OR slug ILIKE '%evolving-skies%'
  `);
  console.log('Sets found:', sets);

  if (sets.length > 0) {
    const setId = sets[0].id;
    // Top chase cards in Evolving Skies (Moonbreon, Rayquaza VMAX Alt, etc.)
    const cards = await dbQuery<any>(`
      SELECT c.id, c.name, c.slug, c.number, c.rarity, c.tcg_player_id, c.tcgplayer_url, c.pricecharting_url, c.snkrdunk_url,
             cpc.headline_cents, cpc.headline_source, cpc.source_prices, cpc.graded_prices
      FROM cards c
      LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
      WHERE c.set_id = $1
      ORDER BY COALESCE(cpc.headline_cents, 0) DESC
      LIMIT 25;
    `, [setId]);

    console.log(`\nTop 25 cards in Evolving Skies (Set ID: ${setId}):`);
    for (const c of cards) {
      const sp = c.source_prices || {};
      const spSummary = Object.entries(sp).map(([k, v]: [string, any]) => `${k}: $${v.price ?? v}`).join(', ');
      console.log(`\n- #${c.number} ${c.name} (${c.rarity}) [${c.slug}]`);
      console.log(`  Headline: $${(c.headline_cents || 0)/100} (Source: ${c.headline_source})`);
      console.log(`  Sources: [${spSummary}]`);
      console.log(`  TCGPlayer: ${c.tcg_player_id} | ${c.tcgplayer_url}`);
      console.log(`  PriceCharting: ${c.pricecharting_url}`);
      console.log(`  Snkrdunk: ${c.snkrdunk_url}`);
    }
  }
}

findEvolvingSkies().then(() => process.exit(0));
