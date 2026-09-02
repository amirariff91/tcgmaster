import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

interface CardRow {
  id: string;
  name: string;
  number: string;
  image_url: string;
  set_code: string;
}

function getSeriesPrefix(setCode: string): string | null {
  const upper = setCode.toUpperCase();
  if (upper.startsWith('SV')) return 'SV';
  if (upper.startsWith('SM')) return 'SM';
  if (upper.startsWith('S') && !upper.startsWith('SM') && !upper.startsWith('SV')) return 'S';
  return null;
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const proc = Bun.spawnSync(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '2', url]);
    const code = proc.stdout.toString().trim();
    return code === '200';
  } catch {
    return false;
  }
}

async function resolveBestWorkingUrl(card: CardRow): Promise<string | null> {
  // 1. Test current URL
  if (card.image_url && (await checkUrl(card.image_url))) {
    return card.image_url;
  }

  // 2. Test alternate permutations
  const serie = getSeriesPrefix(card.set_code);
  if (!serie) return null;

  const rawNum = card.number.trim().split('/')[0];
  const padded3 = rawNum.padStart(3, '0');
  const cleanNum = rawNum.replace(/^0+/, '') || '1';

  const candidates = [
    `https://assets.tcgdex.net/ja/${serie}/${card.set_code}/${padded3}/high.webp`,
    `https://assets.tcgdex.net/ja/${serie}/${card.set_code.toLowerCase()}/${padded3}/high.webp`,
    `https://assets.tcgdex.net/ja/${serie}/${card.set_code}/${cleanNum}/high.webp`,
    `https://assets.tcgdex.net/ja/${serie}/${card.set_code.toLowerCase()}/${cleanNum}/high.webp`,
    `https://assets.tcgdex.net/ja/${serie}/${card.set_code}/${padded3}/high.png`,
  ];

  for (const candidate of candidates) {
    if (candidate === card.image_url) continue;
    if (await checkUrl(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function run() {
  console.log('[Image Verification & Pruning] Loading all Japanese cards with image_url...');

  const cards = await dbQuery<CardRow>(`
    SELECT c.id, c.name, c.number, c.image_url, s.ppt_set_id AS set_code
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug LIKE 'pokemon-%-ja'
      AND c.image_url IS NOT NULL
  `);

  console.log(`[Image Verification & Pruning] Found ${cards.length} cards to verify.`);

  const updates: Array<{ id: string; image_url: string | null }> = [];
  let verifiedOk = 0;
  let prunedCount = 0;
  let fixedCount = 0;

  const concurrency = 25;
  for (let i = 0; i < cards.length; i += concurrency) {
    const chunk = cards.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (c) => {
        const workingUrl = await resolveBestWorkingUrl(c);
        return {
          id: c.id,
          originalUrl: c.image_url,
          workingUrl,
        };
      }),
    );

    for (const r of results) {
      if (r.workingUrl) {
        if (r.workingUrl !== r.originalUrl) {
          fixedCount++;
          updates.push({ id: r.id, image_url: r.workingUrl });
        } else {
          verifiedOk++;
        }
      } else {
        prunedCount++;
        updates.push({ id: r.id, image_url: null });
      }
    }

    if ((i + concurrency) % 500 === 0 || i + concurrency >= cards.length) {
      console.log(`[Image Verification & Pruning] Progress: ${Math.min(i + concurrency, cards.length)} / ${cards.length} (Verified OK: ${verifiedOk}, Fixed: ${fixedCount}, Pruned 404s: ${prunedCount})`);
    }
  }

  console.log(`\n========================================`);
  console.log(`[Image Verification & Pruning] Summary:`);
  console.log(`- 100% Working (HTTP 200): ${verifiedOk + fixedCount}`);
  console.log(`- Pruned 404 Broken Images: ${prunedCount}`);
  console.log(`- Database Updates to Apply: ${updates.length}`);
  console.log(`========================================\n`);

  // Batch update database in chunks of 500
  const batchSize = 500;
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
  }

  console.log('[Image Verification & Pruning] Database updated successfully.');

  // Flush Redis search & sets cache
  await redis.del('api:search:trending');
  const searchKeys = await redis.keys('search:*');
  for (const k of searchKeys) await redis.del(k);
  console.log('[Image Verification & Pruning] Flushed search cache.');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
