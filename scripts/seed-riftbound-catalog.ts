import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';

interface RiftcodexSet {
  id: string;
  name: string;
  set_id: string;
  card_count: number;
  tcgplayer_id: string | null;
  cardmarket_id: string[] | null;
  published_on: string | null;
}

interface RiftcodexCard {
  id: string;
  name: string;
  riftbound_id: string;
  tcgplayer_id: string | null;
  collector_number: number | string;
  attributes?: {
    energy?: number | null;
    might?: number | null;
    power?: number | null;
  };
  classification?: {
    type?: string | null;
    supertype?: string | null;
    rarity?: string | null;
    domain?: string[];
  };
  text?: {
    plain?: string | null;
    rich?: string | null;
    flavour?: string | null;
  };
  media?: {
    image_url?: string | null;
    artist?: string | null;
    accessibility_text?: string | null;
  };
  tags?: string[];
  orientation?: string;
  metadata?: {
    clean_name?: string;
    alternate_art?: boolean;
    overnumbered?: boolean;
    signature?: boolean;
  };
}

interface CardsApiResponse {
  items: RiftcodexCard[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeCardSlug(setId: string, card: RiftcodexCard, index: number, seenSlugs: Set<string>): string {
  const numStr = String(card.collector_number || card.riftbound_id || index + 1);
  const nameStr = card.name || 'card';
  let baseSlug = `riftbound-${sanitizeSlug(setId)}-${sanitizeSlug(numStr)}-${sanitizeSlug(nameStr)}`;
  
  if (baseSlug.length > 90) {
    baseSlug = `riftbound-${sanitizeSlug(setId)}-${sanitizeSlug(numStr)}`;
  }

  let uniqueSlug = baseSlug;
  let counter = 1;
  while (seenSlugs.has(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-v${counter}`;
  }
  seenSlugs.add(uniqueSlug);
  return uniqueSlug;
}

async function seedRiftboundCatalog() {
  console.log('[Riftbound Ingest] Starting ingestion from api.riftcodex.com...');

  // 1. Ensure Riftbound game exists in database
  const gameRows = await dbQuery<{ id: string }>(
    `INSERT INTO games (name, slug, display_name, icon, is_active)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (slug) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       is_active = EXCLUDED.is_active
     RETURNING id`,
    ['riftbound', 'riftbound', 'Riftbound', '/icons/riftbound.svg', true],
  );

  const gameId = gameRows[0].id;
  console.log(`[Riftbound Ingest] Game ID: ${gameId}`);

  // 2. Fetch all sets
  console.log('[Riftbound Ingest] Fetching sets metadata...');
  const setsRes = await fetch('https://api.riftcodex.com/sets');
  if (!setsRes.ok) {
    throw new Error(`Failed to fetch sets from Riftcodex: ${setsRes.status} ${setsRes.statusText}`);
  }

  const setsData = (await setsRes.json()) as { items: RiftcodexSet[] };
  const allSets = setsData.items || [];
  console.log(`[Riftbound Ingest] Found ${allSets.length} sets.`);

  let totalSetsIngested = 0;
  let totalCardsIngested = 0;

  for (let i = 0; i < allSets.length; i++) {
    const setInfo = allSets[i];
    const setSlug = `riftbound-${sanitizeSlug(setInfo.set_id || setInfo.name)}`;
    console.log(`\n[${i + 1}/${allSets.length}] Set: "${setInfo.name}" (${setInfo.set_id}) [Card Count: ${setInfo.card_count}]`);

    const releaseDate = setInfo.published_on ? new Date(setInfo.published_on).toISOString() : null;

    const setRows = await dbQuery<{ id: string }>(
      `INSERT INTO sets (game_id, name, slug, release_date, card_count, ppt_set_id, tcg_player_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (game_id, slug) DO UPDATE SET
         name = EXCLUDED.name,
         release_date = EXCLUDED.release_date,
         card_count = EXCLUDED.card_count,
         ppt_set_id = EXCLUDED.ppt_set_id,
         tcg_player_group_id = EXCLUDED.tcg_player_group_id
       RETURNING id`,
      [
        gameId,
        setInfo.name,
        setSlug,
        releaseDate,
        setInfo.card_count,
        setInfo.set_id,
        setInfo.tcgplayer_id,
      ],
    );

    const setIdInDb = setRows[0].id;

    // 3. Fetch cards with pagination
    let page = 1;
    let hasMore = true;
    const cardsInSet: RiftcodexCard[] = [];

    while (hasMore) {
      const cardsUrl = `https://api.riftcodex.com/cards?set_id=${encodeURIComponent(setInfo.set_id)}&size=100&page=${page}`;
      const cardsRes = await fetch(cardsUrl);
      if (!cardsRes.ok) {
        console.warn(`[Riftbound Ingest] Failed to fetch cards page ${page} for set ${setInfo.set_id}: ${cardsRes.status}`);
        break;
      }

      const cardsData = (await cardsRes.json()) as CardsApiResponse;
      const items = cardsData.items || [];
      cardsInSet.push(...items);

      if (page >= cardsData.pages || items.length === 0) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`  -> Fetched ${cardsInSet.length} cards for set ${setInfo.set_id}`);

    // 4. Format cards
    const seenSlugs = new Set<string>();
    const formattedCards = cardsInSet.map((card, index) => {
      const cardSlug = makeCardSlug(setInfo.set_id, card, index, seenSlugs);
      const description = card.text?.plain || card.media?.accessibility_text || null;
      const lore = card.text?.flavour || null;
      const imageUrl = card.media?.image_url || null;
      const tcgplayerId = card.tcgplayer_id ? String(card.tcgplayer_id) : null;
      const tcgplayerUrl = tcgplayerId ? `https://www.tcgplayer.com/product/${tcgplayerId}` : null;

      const printRunInfo = {
        riftbound_id: card.riftbound_id,
        attributes: card.attributes || {},
        classification: card.classification || {},
        tags: card.tags || [],
        orientation: card.orientation || 'portrait',
        metadata: card.metadata || {},
      };

      return {
        set_id: setIdInDb,
        name: card.name,
        slug: cardSlug,
        number: String(card.collector_number || card.riftbound_id || index + 1),
        rarity: card.classification?.rarity || null,
        artist: card.media?.artist || null,
        description: description,
        lore: lore,
        image_url: imageUrl,
        tcg_player_id: tcgplayerId,
        tcgplayer_url: tcgplayerUrl,
        print_run_info: printRunInfo,
      };
    });

    // 5. Batch insert cards in chunks of 100
    const chunkSize = 100;
    for (let c = 0; c < formattedCards.length; c += chunkSize) {
      const chunk = formattedCards.slice(c, c + chunkSize);
      await dbQuery(
        `INSERT INTO cards (
           set_id, name, slug, number, rarity, artist, description, lore, image_url, tcg_player_id, tcgplayer_url, print_run_info
         )
         SELECT set_id, name, slug, number, rarity, artist, description, lore, image_url, tcg_player_id, tcgplayer_url, print_run_info
         FROM jsonb_to_recordset($1::jsonb) AS c(
           set_id uuid, name text, slug text, number text, rarity text, artist text,
           description text, lore text, image_url text, tcg_player_id text, tcgplayer_url text, print_run_info jsonb
         )
         ON CONFLICT (set_id, slug) DO UPDATE SET
           name = EXCLUDED.name,
           number = EXCLUDED.number,
           rarity = EXCLUDED.rarity,
           artist = EXCLUDED.artist,
           description = EXCLUDED.description,
           lore = EXCLUDED.lore,
           image_url = EXCLUDED.image_url,
           tcg_player_id = EXCLUDED.tcg_player_id,
           tcgplayer_url = EXCLUDED.tcgplayer_url,
           print_run_info = EXCLUDED.print_run_info`,
        [JSON.stringify(chunk)],
      );
    }

    // Update set card_count
    await dbQuery(
      `UPDATE sets SET card_count = $1 WHERE id = $2`,
      [cardsInSet.length, setIdInDb],
    );

    totalCardsIngested += cardsInSet.length;
    totalSetsIngested++;
  }

  console.log(`\n========================================`);
  console.log(`[Riftbound Ingest] Ingestion Completed Successfully!`);
  console.log(`Total Sets Ingested: ${totalSetsIngested}`);
  console.log(`Total Cards Ingested: ${totalCardsIngested}`);
  console.log(`========================================\n`);
}

seedRiftboundCatalog()
  .catch((err) => {
    console.error('[Riftbound Ingest] Fatal Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
