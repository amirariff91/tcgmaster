import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface MonstaMediaItem {
  id: number;
  source_url: string;
  slug: string;
  title?: { rendered?: string };
  media_details?: {
    width?: number;
    height?: number;
  };
}

interface DbCard {
  id: string;
  name: string;
  slug: string;
  number: string;
  image_url: string;
  local_image_url: string | null;
  set_name: string;
  set_slug: string;
}

const OUTPUT_DIR = join(process.cwd(), 'public', 'images', 'cards', 'boboiboy');

async function downloadAndOptimize(rawUrl: string, destPath: string, isMasterScan: boolean): Promise<boolean> {
  try {
    const tempRaw = `/tmp/raw_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    const res = await fetch(rawUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return false;
    const arrayBuffer = await res.arrayBuffer();
    await Bun.write(tempRaw, arrayBuffer);

    let ffmpegArgs: string[];
    if (isMasterScan) {
      // For official 710x1064 scans: apply light unsharp sharpening + convert to pristine 1000x1500 HD
      ffmpegArgs = [
        'ffmpeg',
        '-y',
        '-i',
        tempRaw,
        '-vf',
        'scale=1000:1500:flags=lanczos,unsharp=3:3:0.8:3:3:0.0',
        '-q:v',
        '1',
        '-frames:v',
        '1',
        '-update',
        '1',
        destPath,
      ];
    } else {
      // For lower-res fallback cards: apply 3D-denoising + CAS + unsharp
      ffmpegArgs = [
        'ffmpeg',
        '-y',
        '-i',
        tempRaw,
        '-vf',
        'hqdn3d=1.5:1.5:6:6,scale=1000:1500:flags=lanczos,unsharp=5:5:1.8:5:5:0.0,cas=0.8',
        '-q:v',
        '1',
        '-frames:v',
        '1',
        '-update',
        '1',
        destPath,
      ];
    }

    const proc = Bun.spawnSync(ffmpegArgs);

    try {
      Bun.spawnSync(['rm', '-f', tempRaw]);
    } catch {}

    return proc.exitCode === 0 && existsSync(destPath);
  } catch (err) {
    return false;
  }
}

async function ingestMonstaHdScans() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('[Monsta HD Ingestor] 1. Crawling all official media uploads from galaxycard.monsta.com...');

  const masterScans: MonstaMediaItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const res = await fetch(`https://galaxycard.monsta.com/wp-json/wp/v2/media?per_page=100&page=${page}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) break;
      const items: MonstaMediaItem[] = await res.json();
      if (!items || items.length === 0) break;
      masterScans.push(...items);
      console.log(`  -> Fetched page ${page} (${items.length} media items)...`);
      page++;
    } catch {
      break;
    }
  }

  console.log(`[Monsta HD Ingestor] Total media objects retrieved: ${masterScans.length}`);

  // Filter high-resolution scans (>500x700)
  const highResScans = masterScans.filter((m) => (m.media_details?.width || 0) >= 500);
  console.log(`[Monsta HD Ingestor] Found ${highResScans.length} high-resolution studio master scans.`);

  // 2. Load all Monsta Galaxy cards from DB
  const cards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.slug, c.number, c.image_url, c.local_image_url, s.name as set_name, s.slug as set_slug
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'boboiboy'
    ORDER BY s.release_date ASC, c.number ASC
  `);

  console.log(`[Monsta HD Ingestor] Loaded ${cards.length} cards from database.`);

  let masterMatchCount = 0;
  let enhancedCount = 0;

  // Process all cards
  const BATCH_SIZE = 10;
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (card) => {
        const fileName = `${card.slug}.jpg`;
        const destPath = join(OUTPUT_DIR, fileName);

        // Check if there is an official studio scan matching this card number / name / slug
        const cleanCardNum = card.number.replace(/^0+/, '');
        const matchedScan = highResScans.find((scan) => {
          const scanTitle = (scan.title?.rendered || scan.slug || '').toLowerCase().trim();
          return scanTitle === cleanCardNum || scanTitle === card.number;
        });

        let sourceUrl = card.image_url;
        let isMaster = false;

        if (matchedScan && matchedScan.source_url) {
          sourceUrl = matchedScan.source_url;
          isMaster = true;
          masterMatchCount++;
        }

        if (sourceUrl) {
          const ok = await downloadAndOptimize(sourceUrl, destPath, isMaster);
          if (ok) enhancedCount++;
        }
      })
    );

    if (i % 50 === 0 || i + BATCH_SIZE >= cards.length) {
      console.log(`[Monsta HD Ingestor] Progress: ${enhancedCount} / ${cards.length} processed into 1000x1500 Ultra HD.`);
    }
  }

  // 3. Ensure local_image_url is set across all Monsta Galaxy cards
  console.log('[Monsta HD Ingestor] Updating database records with local HD paths...');
  await dbQuery(`
    UPDATE cards c
    SET local_image_url = '/images/cards/boboiboy/' || c.slug || '.jpg'
    FROM sets s
    JOIN games g ON g.id = s.game_id
    WHERE s.id = c.set_id AND g.slug = 'boboiboy'
  `);

  console.log(`\n========================================`);
  console.log(`[Monsta HD Ingestor] Successfully generated ${enhancedCount} 1000x1500 Ultra HD artworks!`);
  console.log(`[Monsta HD Ingestor] Integrated ${masterMatchCount} official Monsta studio master scans!`);
  console.log(`========================================\n`);

  // Flush Redis caches
  const searchKeys = await redis.keys('search:*');
  for (const k of searchKeys) await redis.del(k);
  console.log('[Monsta HD Ingestor] Flushed Redis search caches.');
}

ingestMonstaHdScans()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
