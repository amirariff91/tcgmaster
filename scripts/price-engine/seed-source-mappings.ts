import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createScraperClient } from '../../lib/price-engine/db';
import type { MappingConfidence, MatchedBy } from '../../lib/price-engine/mapping';
import type { PriceSource } from '../../lib/price-engine/write-path';

const PAGE_SIZE = 1000;
const WRITE_CHUNK_SIZE = 500;
const CARD_SELECT = 'id, slug, tcg_player_id, yuyutei_url, cardrush_url, snkrdunk_url';

type SeedCard = {
  id: string;
  slug: string;
  tcg_player_id: string | number | null;
  yuyutei_url: string | null;
  cardrush_url: string | null;
  snkrdunk_url: string | null;
};

type SeedRow = {
  card_id: string;
  source: PriceSource;
  external_id: string | null;
  external_url: string | null;
  external_title: null;
  external_set: null;
  confidence: MappingConfidence;
  matched_by: MatchedBy;
  evidence: { seededFrom: SeededFrom };
  verified_at: null;
};

type SeededFrom =
  | 'dictionary'
  | 'expanded-dictionary'
  | 'tcg_player_id'
  | 'yuyutei_url'
  | 'cardrush_url'
  | 'snkrdunk_url';

type CountKey = `${PriceSource}|${MatchedBy}|${MappingConfidence}`;

type ExistingPairs = {
  pairs: Set<string>;
  manualPairs: Set<string>;
};

function readDictionary(path: string): Record<string, number> {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const dictionary: Record<string, number> = {};

  for (const [slug, rawProductId] of Object.entries(parsed)) {
    const productId = Number(rawProductId);
    if (!Number.isFinite(productId)) {
      throw new Error(`Invalid TCGPlayer product ID for dictionary slug ${slug}`);
    }
    dictionary[slug.toLowerCase()] = productId;
  }

  return dictionary;
}

function pairKey(cardId: string, source: PriceSource): string {
  return `${cardId}|${source}`;
}

function hasValue(value: string | number | null | undefined): value is string | number {
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function seedRow(
  cardId: string,
  source: PriceSource,
  matchedBy: MatchedBy,
  confidence: MappingConfidence,
  seededFrom: SeededFrom,
  externalId: string | null = null,
  externalUrl: string | null = null,
): SeedRow {
  return {
    card_id: cardId,
    source,
    external_id: externalId,
    external_url: externalUrl,
    external_title: null,
    external_set: null,
    confidence,
    matched_by: matchedBy,
    evidence: { seededFrom },
    verified_at: null,
  };
}

async function loadAllCards(db: ReturnType<typeof createScraperClient>): Promise<SeedCard[]> {
  const cards: SeedCard[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await db(
      `SELECT ${CARD_SELECT}
       FROM cards
       ORDER BY id ASC
       LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset],
    ) as SeedCard[];
    cards.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return cards;
}

async function loadExistingPairs(
  db: ReturnType<typeof createScraperClient>,
): Promise<ExistingPairs> {
  const pairs = new Set<string>();
  const manualPairs = new Set<string>();

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await db(
      `SELECT card_id, source, matched_by, confidence
       FROM card_source_mapping
       ORDER BY card_id ASC
       LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset],
    ) as {
      card_id: string;
      source: PriceSource;
      matched_by: MatchedBy;
      confidence: MappingConfidence;
    }[];
    for (const row of page) {
      const key = pairKey(row.card_id, row.source);
      pairs.add(key);
      if (row.matched_by === 'manual') manualPairs.add(key);
    }
    if (page.length < PAGE_SIZE) break;
  }

  return { pairs, manualPairs };
}

async function writeRows(
  db: ReturnType<typeof createScraperClient>,
  rows: SeedRow[],
  ignoreDuplicates: boolean,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += WRITE_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + WRITE_CHUNK_SIZE);
    const conflictAction = ignoreDuplicates
      ? 'DO NOTHING'
      : `DO UPDATE SET
           external_id = EXCLUDED.external_id,
           external_url = EXCLUDED.external_url,
           external_title = EXCLUDED.external_title,
           external_set = EXCLUDED.external_set,
           confidence = EXCLUDED.confidence,
           matched_by = EXCLUDED.matched_by,
           evidence = EXCLUDED.evidence,
           verified_at = EXCLUDED.verified_at,
           updated_at = NOW()`;

    await db(
      `INSERT INTO card_source_mapping (
         card_id, source, external_id, external_url, external_title, external_set,
         confidence, matched_by, evidence, verified_at
       )
       SELECT card_id, source, external_id, external_url, external_title, external_set,
              confidence, matched_by, evidence, verified_at
       FROM jsonb_to_recordset($1::jsonb) AS rows(
         card_id uuid,
         source price_source,
         external_id text,
         external_url text,
         external_title text,
         external_set text,
         confidence mapping_confidence,
         matched_by text,
         evidence jsonb,
         verified_at timestamptz
       )
       ON CONFLICT (card_id, source) ${conflictAction}`,
      [JSON.stringify(chunk)],
    );
  }
}

function report(
  rows: SeedRow[],
  orphanedSlugs: Set<string>,
  skippedSuspectUrl: number,
  skippedVariantCollision: number,
  skippedJaDictionary: number,
  skippedManual: number,
  dryRun: boolean,
): void {
  const counts = new Map<CountKey, number>();
  for (const row of rows) {
    const key: CountKey = `${row.source}|${row.matched_by}|${row.confidence}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  console.log(`Source-mapping seed${dryRun ? ' (dry-run)' : ''}`);
  console.log('source\tmatched_by\tconfidence\tcount');
  for (const [key, count] of [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const [source, matchedBy, confidence] = key.split('|');
    console.log(`${source}\t${matchedBy}\t${confidence}\t${count}`);
  }
  console.log(`orphaned\t${orphanedSlugs.size}`);
  for (const slug of [...orphanedSlugs].sort()) console.log(`ORPHANED\t${slug}`);
  console.log(`skipped-suspect-url\t${skippedSuspectUrl}`);
  console.log(`skipped-variant-collision\t${skippedVariantCollision}`);
  console.log(`skipped-ja-dictionary\t${skippedJaDictionary}`);
  console.log(`skipped-manual\t${skippedManual}`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const originalDictionary = readDictionary(resolve(projectRoot, 'lib/price-engine/mapping-dictionary.json'));
  const expandedDictionary = readDictionary(resolve(projectRoot, 'scripts/price-engine/mapping-dictionary-expanded.json'));
  const db = createScraperClient();
  const [cards, existing] = await Promise.all([
    loadAllCards(db),
    loadExistingPairs(db),
  ]);

  const cardsBySlug = new Map(cards.map((card) => [card.slug.toLowerCase(), card]));
  const plannedPairs = new Set(existing.pairs);
  const confirmedRows: SeedRow[] = [];
  const derivedRows: SeedRow[] = [];
  const orphanedSlugs = new Set<string>();
  const combinedDictionary = { ...expandedDictionary, ...originalDictionary };
  let skippedSuspectUrl = 0;
  let skippedVariantCollision = 0;
  let skippedJaDictionary = 0;
  let skippedManual = 0;

  for (const [slug, productId] of Object.entries(originalDictionary)) {
    if (slug.endsWith('-ja')) {
      skippedJaDictionary++;
      continue;
    }

    const card = cardsBySlug.get(slug);
    if (!card) {
      orphanedSlugs.add(slug);
      continue;
    }

    const pair = pairKey(card.id, 'tcgplayer');
    if (existing.manualPairs.has(pair)) {
      skippedManual++;
      continue;
    }

    confirmedRows.push(seedRow(
      card.id,
      'tcgplayer',
      'dictionary',
      'confirmed',
      'dictionary',
      String(productId),
    ));
    plannedPairs.add(pair);
  }

  for (const [slug, productId] of Object.entries(expandedDictionary)) {
    if (slug.endsWith('-ja')) {
      skippedJaDictionary++;
      continue;
    }

    const variantBaseSlug = slug.replace(/[_-]p\d+$/i, '');
    const baseProductId = combinedDictionary[variantBaseSlug];
    if (baseProductId !== undefined && productId === baseProductId) {
      skippedVariantCollision++;
      continue;
    }

    const card = cardsBySlug.get(slug);
    if (!card) {
      orphanedSlugs.add(slug);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(originalDictionary, slug)) continue;

    derivedRows.push(seedRow(
      card.id,
      'tcgplayer',
      'dictionary',
      'derived',
      'expanded-dictionary',
      String(productId),
    ));
    plannedPairs.add(pairKey(card.id, 'tcgplayer'));
  }

  for (const card of cards) {
    if (hasValue(card.tcg_player_id) && !plannedPairs.has(pairKey(card.id, 'tcgplayer'))) {
      derivedRows.push(seedRow(
        card.id,
        'tcgplayer',
        'product-id',
        'derived',
        'tcg_player_id',
        String(card.tcg_player_id),
      ));
      plannedPairs.add(pairKey(card.id, 'tcgplayer'));
    }
  }

  for (const card of cards) {
    const urlSources: Array<{
      source: 'yuyutei' | 'cardrush' | 'snkrdunk';
      url: string | null;
      seededFrom: 'yuyutei_url' | 'cardrush_url' | 'snkrdunk_url';
      requiredPath?: string;
    }> = [
      { source: 'yuyutei', url: card.yuyutei_url, seededFrom: 'yuyutei_url', requiredPath: '/sell/opc/card/' },
      { source: 'cardrush', url: card.cardrush_url, seededFrom: 'cardrush_url', requiredPath: '/product/' },
      { source: 'snkrdunk', url: card.snkrdunk_url, seededFrom: 'snkrdunk_url' },
    ];

    for (const { source, url, seededFrom, requiredPath } of urlSources) {
      if (!hasValue(url)) continue;
      const externalUrl = String(url).trim();

      if (requiredPath && !externalUrl.toLowerCase().includes(requiredPath)) {
        skippedSuspectUrl++;
        continue;
      }
      if (plannedPairs.has(pairKey(card.id, source))) continue;

      derivedRows.push(seedRow(card.id, source, 'url', 'derived', seededFrom, null, externalUrl));
      plannedPairs.add(pairKey(card.id, source));
    }
  }

  report(
    [...confirmedRows, ...derivedRows],
    orphanedSlugs,
    skippedSuspectUrl,
    skippedVariantCollision,
    skippedJaDictionary,
    skippedManual,
    dryRun,
  );
  if (dryRun) return;

  await writeRows(db, confirmedRows, false);
  await writeRows(db, derivedRows, true);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
