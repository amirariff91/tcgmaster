import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';

interface RawSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  ptcgoCode?: string;
  images?: {
    symbol?: string;
    logo?: string;
  };
}

interface RawCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  level?: string;
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  abilities?: Array<{
    name: string;
    text: string;
    type: string;
  }>;
  attacks?: Array<{
    name: string;
    cost: string[];
    convertedEnergyCost: number;
    damage: string;
    text: string;
  }>;
  weaknesses?: Array<{ type: string; value: string }>;
  resistances?: Array<{ type: string; value: string }>;
  retreatCost?: string[];
  convertedRetreatCost?: number;
  number: string;
  artist?: string;
  rarity?: string;
  flavorText?: string;
  nationalPokedexNumbers?: number[];
  legalities?: Record<string, string>;
  images?: {
    small?: string;
    large?: string;
  };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, unknown>;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, unknown>;
  };
}

const POKEMON_GAME_ID = '18653911-4af3-4697-8fab-93b9c73aa97d';
const BASE_DATA_URL = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';

function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeCardSlug(setId: string, card: RawCard, index: number, seenSlugs: Set<string>): string {
  let idPart = (card.id || `${setId}-${card.number || index}`)
    .replace(/!/g, '-excl')
    .replace(/\?/g, '-quest')
    .replace(/\+/g, '-plus')
    .replace(/★/g, '-star');

  let slug = `pokemon-${sanitizeSlug(idPart)}`;
  if (!slug || slug === 'pokemon-') {
    slug = `pokemon-${sanitizeSlug(setId)}-${index + 1}`;
  }

  // Guarantee uniqueness within set
  let uniqueSlug = slug;
  let counter = 1;
  while (seenSlugs.has(uniqueSlug)) {
    counter++;
    uniqueSlug = `${slug}-v${counter}`;
  }
  seenSlugs.add(uniqueSlug);
  return uniqueSlug;
}

function formatDescription(card: RawCard): string {
  const parts: string[] = [];

  if (card.abilities && card.abilities.length > 0) {
    for (const ability of card.abilities) {
      parts.push(`[${ability.type || 'Ability'}: ${ability.name}] ${ability.text}`);
    }
  }

  if (card.attacks && card.attacks.length > 0) {
    for (const attack of card.attacks) {
      const cost = attack.cost?.join(', ') || 'No Cost';
      const dmg = attack.damage ? ` (${attack.damage} Dmg)` : '';
      const text = attack.text ? ` - ${attack.text}` : '';
      parts.push(`[Attack: ${attack.name}${dmg} | Cost: ${cost}]${text}`);
    }
  }

  return parts.join('\n\n');
}

async function seedPokemonCatalog() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const targetSetArg = args.find((a) => a.startsWith('--set='));
  const targetSet = targetSetArg ? targetSetArg.split('=')[1] : null;
  const isVintageOnly = args.includes('--vintage');

  console.log(`[Pokemon Ingest] Starting ingestion... DryRun=${isDryRun}, TargetSet=${targetSet || 'ALL'}, VintageOnly=${isVintageOnly}`);

  // 1. Fetch sets list
  console.log(`[Pokemon Ingest] Fetching sets metadata from ${BASE_DATA_URL}/sets/en.json...`);
  const setsRes = await fetch(`${BASE_DATA_URL}/sets/en.json`);
  if (!setsRes.ok) {
    throw new Error(`Failed to fetch sets list: ${setsRes.status} ${setsRes.statusText}`);
  }
  const allSets = (await setsRes.json()) as RawSet[];
  console.log(`[Pokemon Ingest] Total sets in repository: ${allSets.length}`);

  let filteredSets = allSets;
  if (targetSet) {
    filteredSets = allSets.filter((s) => s.id === targetSet || sanitizeSlug(s.name) === sanitizeSlug(targetSet));
  } else if (isVintageOnly) {
    const vintageSeries = new Set(['Base', 'Neo', 'E-Card', 'EX']);
    filteredSets = allSets.filter((s) => vintageSeries.has(s.series));
  }

  console.log(`[Pokemon Ingest] Processing ${filteredSets.length} sets...`);

  let totalCardsIngested = 0;
  let totalSetsIngested = 0;

  for (let i = 0; i < filteredSets.length; i++) {
    const setInfo = filteredSets[i];
    const setSlug = `pokemon-${sanitizeSlug(setInfo.id)}`;
    console.log(`\n[${i + 1}/${filteredSets.length}] Set: "${setInfo.name}" (${setInfo.id}) [Series: ${setInfo.series}]`);

    let setIdInDb: string | null = null;

    if (!isDryRun) {
      // Upsert set into Postgres
      const releaseDate = setInfo.releaseDate ? new Date(setInfo.releaseDate.replace(/\//g, '-')).toISOString() : null;
      const setLogo = setInfo.images?.logo || setInfo.images?.symbol || null;

      const setRows = await dbQuery<{ id: string }>(
        `INSERT INTO sets (game_id, name, slug, release_date, card_count, image_url, ppt_set_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (game_id, slug) DO UPDATE SET
           name = EXCLUDED.name,
           release_date = EXCLUDED.release_date,
           card_count = EXCLUDED.card_count,
           image_url = EXCLUDED.image_url,
           ppt_set_id = EXCLUDED.ppt_set_id
         RETURNING id`,
        [POKEMON_GAME_ID, setInfo.name, setSlug, releaseDate, setInfo.total || setInfo.printedTotal, setLogo, setInfo.id],
      );

      setIdInDb = setRows[0].id;
    }

    // 2. Fetch cards for this set
    const cardsUrl = `${BASE_DATA_URL}/cards/en/${setInfo.id}.json`;
    const cardsRes = await fetch(cardsUrl);
    if (!cardsRes.ok) {
      console.warn(`[Pokemon Ingest] ⚠️ Could not fetch cards for set ${setInfo.id} (${cardsRes.status})`);
      continue;
    }

    const rawCards = (await cardsRes.json()) as RawCard[];
    console.log(`  -> Found ${rawCards.length} cards in set ${setInfo.id}`);

    if (isDryRun) {
      totalCardsIngested += rawCards.length;
      totalSetsIngested++;
      continue;
    }

    if (!setIdInDb) continue;

    // 3. Prepare cards batch with collision-safe slugs
    const seenSlugs = new Set<string>();
    const formattedCards = rawCards.map((card, index) => {
      const cardSlug = makeCardSlug(setInfo.id, card, index, seenSlugs);
      const description = formatDescription(card);
      const imageUrl = card.images?.large || card.images?.small || null;
      const tcgplayerUrl = card.tcgplayer?.url || null;

      const printRunInfo = {
        supertype: card.supertype,
        subtypes: card.subtypes || [],
        level: card.level || null,
        hp: card.hp ? Number(card.hp) : null,
        types: card.types || [],
        evolvesFrom: card.evolvesFrom || null,
        retreatCost: card.retreatCost || [],
        convertedRetreatCost: card.convertedRetreatCost || 0,
        weaknesses: card.weaknesses || [],
        resistances: card.resistances || [],
        nationalPokedexNumbers: card.nationalPokedexNumbers || [],
        legalities: card.legalities || {},
        series: setInfo.series,
        ptcgoCode: setInfo.ptcgoCode || null,
      };

      return {
        set_id: setIdInDb,
        name: card.name,
        slug: cardSlug,
        number: card.number,
        rarity: card.rarity || null,
        artist: card.artist || null,
        description: description || null,
        lore: card.flavorText || null,
        image_url: imageUrl,
        tcgplayer_url: tcgplayerUrl,
        print_run_info: printRunInfo,
      };
    });

    // 4. Batch upsert cards in chunks of 100
    const chunkSize = 100;
    for (let c = 0; c < formattedCards.length; c += chunkSize) {
      const chunk = formattedCards.slice(c, c + chunkSize);
      await dbQuery(
        `INSERT INTO cards (
           set_id, name, slug, number, rarity, artist, description, lore, image_url, tcgplayer_url, print_run_info
         )
         SELECT set_id, name, slug, number, rarity, artist, description, lore, image_url, tcgplayer_url, print_run_info
         FROM jsonb_to_recordset($1::jsonb) AS c(
           set_id uuid, name text, slug text, number text, rarity text, artist text,
           description text, lore text, image_url text, tcgplayer_url text, print_run_info jsonb
         )
         ON CONFLICT (set_id, slug) DO UPDATE SET
           name = EXCLUDED.name,
           number = EXCLUDED.number,
           rarity = EXCLUDED.rarity,
           artist = EXCLUDED.artist,
           description = EXCLUDED.description,
           lore = EXCLUDED.lore,
           image_url = EXCLUDED.image_url,
           tcgplayer_url = EXCLUDED.tcgplayer_url,
           print_run_info = EXCLUDED.print_run_info`,
        [JSON.stringify(chunk)],
      );
    }

    // Update set card_count with actual count
    await dbQuery(
      `UPDATE sets SET card_count = $1 WHERE id = $2`,
      [rawCards.length, setIdInDb],
    );

    totalCardsIngested += rawCards.length;
    totalSetsIngested++;
  }

  console.log(`\n========================================`);
  console.log(`[Pokemon Ingest] Ingestion Completed Successfully!`);
  console.log(`Total Sets Ingested: ${totalSetsIngested}`);
  console.log(`Total Cards Ingested: ${totalCardsIngested}`);
  console.log(`========================================\n`);
}

seedPokemonCatalog()
  .catch((err) => {
    console.error('[Pokemon Ingest] Fatal Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
