import { createScraperClient } from '../../lib/price-engine/db';
import { persistObservations, type CardRef } from '../../lib/price-engine/write-path';
import { fetchCard as fetchEnglishOpCard } from './queue-english-op';
import { fetchCard as fetchJapaneseOpCard } from './queue-jp-op';
import { fetchCard as fetchDbfwCard } from './queue-dbfw';
import { fetchCard as fetchEnglishDbfwCard } from './queue-english-dbfw';
import type { WorkerCard } from '../../lib/price-engine/worker';

const CARD_SELECT = 'id, name, slug, number, tcg_player_id, print_run_info, yuyutei_url, cardrush_url, sets ( name )';

function usage(): never {
  console.error('Usage: bun run scripts/price-engine/scrape-once.ts --slug <card-slug>');
  process.exit(1);
}

function fetcherForSlug(slug: string): (card: WorkerCard) => ReturnType<typeof fetchEnglishOpCard> {
  const lowerSlug = slug.toLowerCase();

  if (lowerSlug.startsWith('op-')) {
    return lowerSlug.endsWith('-ja') ? fetchJapaneseOpCard : fetchEnglishOpCard;
  }

  if (lowerSlug.startsWith('dbfw-')) {
    return lowerSlug.endsWith('-ja') ? fetchDbfwCard : fetchEnglishDbfwCard;
  }

  throw new Error(`Cannot choose a scraper for card slug: ${slug}`);
}

async function main(): Promise<void> {
  const slugFlag = process.argv.indexOf('--slug');
  const slug = slugFlag >= 0 ? process.argv[slugFlag + 1] : undefined;
  if (!slug) usage();

  const db = createScraperClient();
  const { data: card, error } = await db
    .from('cards')
    .select(CARD_SELECT)
    .eq('slug', slug)
    .single();

  if (error) throw new Error(`Failed to load card ${slug}: ${error.message}`);
  if (!card) throw new Error(`Card not found: ${slug}`);

  const cardRef = card as WorkerCard & CardRef;
  const result = await fetcherForSlug(cardRef.slug)(cardRef);
  const persisted = await persistObservations(db, cardRef, result.observations, result.cardUpdates);

  console.log('Observations:', JSON.stringify(result.observations, null, 2));
  console.log('Headline:', JSON.stringify(persisted.headline, null, 2));
  console.log('Written:', JSON.stringify({
    historyRows: persisted.historyRows,
    priceCache: true,
    cardUpdates: result.cardUpdates ?? {},
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
