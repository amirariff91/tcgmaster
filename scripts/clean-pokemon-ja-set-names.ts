import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

interface SetRow {
  id: string;
  name: string;
  slug: string;
}

async function cleanPokemonJaSetNames() {
  console.log('[Clean Pokemon JA Set Names] Loading Japanese Pokemon sets from DB...');

  const sets = await dbQuery<SetRow>(`
    SELECT id, name, slug
    FROM sets
    WHERE slug LIKE 'pokemon-%-ja'
  `);

  console.log(`[Clean Pokemon JA Set Names] Found ${sets.length} Japanese sets.`);

  const updates: Array<{ id: string; name: string }> = [];

  for (const s of sets) {
    // Strip prefix like "SV2a : ", "PMCG5 : ", "S12a : ", "ADV1 : ", "neo1 : "
    const cleanName = s.name.replace(/^[A-Za-z0-9\-_.]+\s*:\s*/, '').trim();
    if (cleanName && cleanName !== s.name) {
      updates.push({ id: s.id, name: cleanName });
    }
  }

  console.log(`[Clean Pokemon JA Set Names] Prepared ${updates.length} sets to update.`);

  for (const u of updates) {
    await dbQuery(`
      UPDATE sets
      SET name = $1
      WHERE id = $2
    `, [u.name, u.id]);
  }

  console.log('[Clean Pokemon JA Set Names] Successfully updated all Japanese set names in PostgreSQL!');

  // Flush Redis sets and search caches
  const setKeys = await redis.keys('api:sets:*');
  for (const k of setKeys) await redis.del(k);
  const searchKeys = await redis.keys('search:*');
  for (const k of searchKeys) await redis.del(k);
  await redis.del('api:search:trending');

  console.log('[Clean Pokemon JA Set Names] Flushed Redis sets and search caches.');
}

cleanPokemonJaSetNames()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
