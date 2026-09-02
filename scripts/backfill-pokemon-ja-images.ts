import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

function getSeriesPrefix(setId: string): string | null {
  const upper = setId.toUpperCase();
  if (upper.startsWith('SV')) return 'SV';
  if (upper.startsWith('SM')) return 'SM';
  if (upper.startsWith('S') && !upper.startsWith('SM') && !upper.startsWith('SV')) return 'S';
  return null;
}

function formatCardNumber(numStr: string): string {
  // If it's pure digits, pad to 3 digits (e.g. '1' -> '001', '12' -> '012')
  const clean = numStr.trim().split('/')[0];
  if (/^\d+$/.test(clean)) {
    return clean.padStart(3, '0');
  }
  return clean;
}

async function backfillPokemonJaImages() {
  console.log('[Pokemon JA Image Backfill] Starting image backfill for modern Japanese sets...');

  // 1. Fetch all cards with missing image_url in SV, S, SM sets
  const cards = await dbQuery<{
    card_id: string;
    card_name: string;
    card_number: string;
    set_code: string;
    set_slug: string;
  }>(`
    SELECT c.id AS card_id, c.name AS card_name, c.number AS card_number, s.ppt_set_id AS set_code, s.slug AS set_slug
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug LIKE 'pokemon-%-ja'
      AND c.image_url IS NULL
      AND (
        s.ppt_set_id LIKE 'SV%' OR
        s.ppt_set_id LIKE 'sv%' OR
        s.ppt_set_id LIKE 'S%' OR
        s.ppt_set_id LIKE 'SM%' OR
        s.ppt_set_id LIKE 'sm%'
      )
  `);

  console.log(`[Pokemon JA Image Backfill] Found ${cards.length} unlinked modern Japanese cards.`);

  if (cards.length === 0) {
    console.log('[Pokemon JA Image Backfill] No cards to backfill.');
    return;
  }

  // 2. Build updates
  const updates: Array<{ id: string; image_url: string }> = [];
  for (const card of cards) {
    const serie = getSeriesPrefix(card.set_code);
    if (!serie) continue;

    const formattedNum = formatCardNumber(card.card_number);
    const imageUrl = `https://assets.tcgdex.net/ja/${serie}/${card.set_code}/${formattedNum}/high.webp`;
    updates.push({ id: card.card_id, image_url: imageUrl });
  }

  console.log(`[Pokemon JA Image Backfill] Prepared ${updates.length} image URLs to backfill.`);

  // 3. Batch update in PostgreSQL in chunks of 500
  const batchSize = 500;
  let updatedCount = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const chunk = updates.slice(i, i + batchSize);
    await dbQuery(`
      UPDATE cards AS c
      SET image_url = v.image_url
      FROM (
        SELECT (x->>'id')::uuid AS id, x->>'image_url' AS image_url
        FROM jsonb_array_elements($1::jsonb) AS x
      ) AS v
      WHERE c.id = v.id
    `, [JSON.stringify(chunk)]);

    updatedCount += chunk.length;
    console.log(`[Pokemon JA Image Backfill] Updated ${updatedCount} / ${updates.length} cards...`);
  }

  console.log(`\n========================================`);
  console.log(`[Pokemon JA Image Backfill] Backfilled ${updatedCount} cards successfully!`);
  console.log(`========================================\n`);

  // 4. Flush Redis search and games caches
  const cacheKeys = [
    'api:search:trending',
    'api:sets:pokemon',
    'api:sets:pokemon:ja',
    'api:games:all',
  ];
  for (const key of cacheKeys) {
    await redis.del(key);
  }
  console.log('[Pokemon JA Image Backfill] Flushed Redis caches.');
}

backfillPokemonJaImages()
  .catch((err) => {
    console.error('[Pokemon JA Image Backfill] Fatal Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
