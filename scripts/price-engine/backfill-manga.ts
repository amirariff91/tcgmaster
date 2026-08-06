import dotenv from 'dotenv';
import { createScraperClient } from '../../lib/price-engine/db';
import { persistObservations } from '../../lib/price-engine/write-path';
import { fetchCard } from './queue-jp-op';
import type { SourceMapping } from '../../lib/price-engine/mapping';
import type { WorkerCard } from '../../lib/price-engine/worker';

dotenv.config({ path: ['.env.local', '.env'] });

const db = createScraperClient();

const MANGA_SLUGS = [
  'op-op01-120_p2-ja',
  'op-op01-120_r2-ja',
  'op-op02-013_r1-ja',
  'op-op02-013_p2-ja',
  'op-op03-122_r1-ja',
  'op-op03-122_p2-ja',
  'op-op04-083_p2-ja',
  'op-op04-083_r1-ja',
  'op-op05-119_p2-ja',
  'op-op05-119_r2-ja',
  'op-op05-069_r1-ja',
  'op-op05-069_p2-ja',
  'op-op05-074_r2-ja',
  'op-op05-074_p2-ja',
  'op-op06-118_p2-ja',
  'op-op06-118_r1-ja',
  'op-eb01-006_r1-ja',
  'op-eb01-006_p2-ja',
  'op-op07-051_p2-ja',
  'op-op08-118_p2-ja',
  'op-op09-118_p2-ja',
  'op-op09-093_p2-ja',
  'op-op09-004_p2-ja',
  'op-op09-051_p2-ja',
  'op-op09-119_p2-ja',
  'op-op10-119_p2-ja',
  'op-eb02-061_p2-ja',
  'op-op11-118_p2-ja',
  'op-op12-118_p2-ja',
  'op-op06-119_p3-ja',
  'op-op13-119_p1-ja',
  'op-op13-119_p3-ja',
  'op-op13-120_p2-ja',
  'op-op13-120_p3-ja',
  'op-op13-118_p2-ja',
  'op-op13-118_p3-ja',
  'op-op14-119_p2-ja',
  'op-op15-118_p2-ja',
  'op-op16-063_p2-ja',
  'op-op16-065_p2-ja',
  'op-op16-073_p2-ja'
];

type BackfillCard = WorkerCard & {
  snkrdunk_url?: string | null;
  pricecharting_url?: string | null;
};

async function run() {
  console.log(`Starting targeted backfill for ${MANGA_SLUGS.length} Manga cards...`);

  const cards = await db(
    `SELECT * FROM cards WHERE slug = ANY($1::text[])`,
    [MANGA_SLUGS],
  ) as BackfillCard[];

  console.log(`Found ${cards.length} matching cards in DB.`);

  for (const card of cards) {
    console.log(`\n======================================================`);
    console.log(`[BACKFILL] Processing: ${card.name} (${card.number}) - ${card.slug}`);

    const mappings: SourceMapping[] = [];
    if (card.snkrdunk_url) {
      mappings.push({ source: 'snkrdunk', externalUrl: card.snkrdunk_url, confidence: 'confirmed' } as SourceMapping);
    }
    if (card.yuyutei_url) {
      mappings.push({ source: 'yuyutei', externalUrl: card.yuyutei_url, confidence: 'confirmed' } as SourceMapping);
    }
    if (card.pricecharting_url) {
      mappings.push({ source: 'pricecharting', externalUrl: card.pricecharting_url, confidence: 'confirmed' } as SourceMapping);
    }

    if (mappings.length === 0) {
      console.log(`[BACKFILL] Skipped: No URLs found for ${card.slug}`);
      continue;
    }

    console.log(`[BACKFILL] Mappings found: ${mappings.map(m => m.source).join(', ')}`);

    try {
      const workerCard = card as unknown as WorkerCard;
      const result = await fetchCard(workerCard, mappings);

      if (result.observations.length > 0) {
        console.log(`[BACKFILL] Successfully fetched ${result.observations.length} price points!`);
        const persisted = await persistObservations(
          db,
          workerCard,
          result.observations,
          result.cardUpdates,
          mappings
        );
        console.log(`[BACKFILL] Persisted: written=${persisted.written} quarantined=${persisted.quarantined}`);
      } else {
        console.log(`[BACKFILL] No prices returned from the scrapers.`);
      }
    } catch (err) {
      console.error(`[BACKFILL] Error fetching ${card.slug}:`, err);
    }

    // Be gentle
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n======================================================");
  console.log("BACKFILL COMPLETE!");
  process.exit(0);
}

run();
