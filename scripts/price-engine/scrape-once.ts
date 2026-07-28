import { createScraperClient } from '../../lib/price-engine/db';
import { getMappingsForCard } from '../../lib/price-engine/mapping';
import { persistObservations, type CardRef } from '../../lib/price-engine/write-path';
import { workerConfig as englishOpConfig } from './queue-english-op';
import { workerConfig as japaneseOpConfig } from './queue-jp-op';
import { workerConfig as dbfwConfig } from './queue-dbfw';
import { workerConfig as englishDbfwConfig } from './queue-english-dbfw';
import type { WorkerCard, WorkerConfig } from '../../lib/price-engine/worker';

const CARD_SELECT = 'id, name, slug, number, tcg_player_id, print_run_info, yuyutei_url, cardrush_url, sets ( name )';

function usage(): never {
  console.error('Usage: bun run scripts/price-engine/scrape-once.ts --slug <card-slug>');
  process.exit(1);
}

function fetcherForSlug(slug: string): WorkerConfig {
  const lowerSlug = slug.toLowerCase();

  if (lowerSlug.startsWith('op-')) {
    return lowerSlug.endsWith('-ja') ? japaneseOpConfig : englishOpConfig;
  }

  if (lowerSlug.startsWith('dbfw-')) {
    return lowerSlug.endsWith('-ja') ? dbfwConfig : englishDbfwConfig;
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
  const config = fetcherForSlug(cardRef.slug);
  const mappings = (await getMappingsForCard(db, cardRef.id)).filter((mapping) => (
    config.sources.includes(mapping.source)
    && (mapping.confidence === 'confirmed' || mapping.confidence === 'derived')
  ));

  for (const source of config.sources) {
    const mapping = mappings.find((candidate) => candidate.source === source);
    const anchor = source === 'tcgplayer' ? mapping?.externalId : mapping?.externalUrl;
    if (!mapping || !anchor) {
      console.log(`[${config.label}] ${source}: no mapping, skipped`);
    } else {
      console.log(`[${config.label}] ${source}: using anchor ${anchor}`);
    }
  }
  console.log('no search performed');

  const result = await config.fetchCard(cardRef, mappings);
  if (result.observations.length === 0) {
    console.log('no observations; nothing persisted');
    return;
  }

  const persisted = await persistObservations(db, cardRef, result.observations, result.cardUpdates, mappings);

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
