import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';

interface DbCard {
  id: string;
  name: string;
  number: string;
  slug: string;
  set_name: string;
  ppt_set_id: string;
}

function sanitizeUrlToken(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function mapPokemonPriceCharting() {
  console.log('[Pokemon PriceCharting Mapper] Loading cards from DB...');

  // 1. English Cards
  const enCards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.number, c.slug, s.name as set_name, s.ppt_set_id
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug LIKE 'pokemon-%'
      AND s.slug NOT LIKE 'pokemon-%-ja'
      AND c.pricecharting_url IS NULL
  `);

  // 2. Japanese Cards
  const jaCards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.number, c.slug, s.name as set_name, s.ppt_set_id
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug LIKE 'pokemon-%-ja'
      AND c.pricecharting_url IS NULL
  `);

  console.log(`[Pokemon PriceCharting Mapper] Found ${enCards.length} EN cards and ${jaCards.length} JA cards to map.`);

  const updates: Array<{ id: string; pricecharting_url: string }> = [];

  // Generate PriceCharting English URLs
  for (const c of enCards) {
    const cleanNum = c.number.replace(/^0+/, '');
    const cardSlug = sanitizeUrlToken(`${c.name} ${cleanNum}`);
    const setSlug = sanitizeUrlToken(`pokemon ${c.set_name}`);
    const pcUrl = `https://www.pricecharting.com/game/${setSlug}/${cardSlug}`;
    updates.push({ id: c.id, pricecharting_url: pcUrl });
  }

  // Generate PriceCharting Japanese URLs
  for (const c of jaCards) {
    const cleanNum = c.number.replace(/^0+/, '');
    const cardSlug = sanitizeUrlToken(`${c.name} ${cleanNum}`);
    const setSlug = sanitizeUrlToken(`pokemon-japanese-${c.set_name}`);
    const pcUrl = `https://www.pricecharting.com/game/${setSlug}/${cardSlug}`;
    updates.push({ id: c.id, pricecharting_url: pcUrl });
  }

  console.log(`[Pokemon PriceCharting Mapper] Prepared ${updates.length} URLs to batch update...`);

  const batchSize = 500;
  for (let i = 0; i < updates.length; i += batchSize) {
    const chunk = updates.slice(i, i + batchSize);
    await dbQuery(`
      UPDATE cards AS c
      SET pricecharting_url = v.pricecharting_url
      FROM (
        SELECT (x->>'id')::uuid AS id, x->>'pricecharting_url' AS pricecharting_url
        FROM jsonb_array_elements($1::jsonb) AS x
      ) AS v
      WHERE c.id = v.id
    `, [JSON.stringify(chunk)]);
    console.log(`[Pokemon PriceCharting Mapper] Updated ${Math.min(i + batchSize, updates.length)} / ${updates.length}...`);
  }

  console.log('[Pokemon PriceCharting Mapper] PriceCharting URLs mapped successfully!');
}

mapPokemonPriceCharting()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
