import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface DbCard {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  local_image_url: string | null;
}

const OUTPUT_DIR = join(process.cwd(), 'public', 'images', 'cards', 'boboiboy');

async function upscaleImage(rawUrl: string, destPath: string): Promise<boolean> {
  try {
    const tempRaw = `/tmp/raw_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    // 1. Download raw image
    const res = await fetch(rawUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return false;
    const arrayBuffer = await res.arrayBuffer();
    await Bun.write(tempRaw, arrayBuffer);

    // 2. High-Quality 4x Lanczos + Unsharp Sharpening via ffmpeg
    const proc = Bun.spawnSync([
      'ffmpeg',
      '-y',
      '-i',
      tempRaw,
      '-vf',
      'scale=800:1200:flags=lanczos,unsharp=5:5:1.2:5:5:0.0',
      '-q:v',
      '2',
      '-frames:v',
      '1',
      '-update',
      '1',
      destPath,
    ]);

    // Clean up temp
    try {
      Bun.spawnSync(['rm', '-f', tempRaw]);
    } catch {}

    return proc.exitCode === 0 && existsSync(destPath);
  } catch (err) {
    return false;
  }
}

async function upscaleMonstaGalaxyImages() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('[Monsta Galaxy HD Upscaler] Loading Monsta Galaxy cards from DB...');

  const cards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.slug, c.image_url, c.local_image_url
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'boboiboy' AND c.image_url IS NOT NULL
    ORDER BY c.slug ASC
  `);

  console.log(`[Monsta Galaxy HD Upscaler] Found ${cards.length} cards to upscale.`);

  let upscaledCount = 0;
  const updates: Array<{ id: string; local_image_url: string }> = [];

  // Process in parallel batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (c) => {
        const fileName = `${c.slug}.jpg`;
        const destPath = join(OUTPUT_DIR, fileName);
        const webPath = `/images/cards/boboiboy/${fileName}`;

        const ok = await upscaleImage(c.image_url, destPath);
        if (ok) {
          updates.push({ id: c.id, local_image_url: webPath });
          upscaledCount++;
        }
      })
    );

    if (i % 50 === 0 || i + BATCH_SIZE >= cards.length) {
      console.log(`[Monsta Galaxy HD Upscaler] Progress: ${upscaledCount} / ${cards.length} cards upscaled to 800x1200 HD.`);
    }
  }

  console.log(`\n[Monsta Galaxy HD Upscaler] Updating PostgreSQL database with local HD paths...`);

  // Batch update PostgreSQL
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    for (const u of batch) {
      await dbQuery('UPDATE cards SET local_image_url = $1 WHERE id = $2', [u.local_image_url, u.id]);
    }
  }

  console.log(`\n========================================`);
  console.log(`[Monsta Galaxy HD Upscaler] Successfully generated ${upscaledCount} 800x1200 HD card artworks!`);
  console.log(`========================================\n`);

  // Flush Redis caches
  const searchKeys = await redis.keys('search:*');
  for (const k of searchKeys) await redis.del(k);
  console.log('[Monsta Galaxy HD Upscaler] Flushed Redis search caches.');
}

upscaleMonstaGalaxyImages()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
