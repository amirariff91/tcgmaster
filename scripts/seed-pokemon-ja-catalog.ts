import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { POKEMON_JA_SET_NAMES } from './translate-pokemon-ja-sets';

interface TCGdexSetSummary {
  id: string;
  name: string;
  cardCount: {
    total: number;
    official?: number;
  };
}

interface TCGdexCardSummary {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

interface TCGdexSetDetail {
  id: string;
  name: string;
  releaseDate?: string;
  cardCount: {
    total: number;
    official?: number;
  };
  cards?: TCGdexCardSummary[];
}

function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeCardSlug(setId: string, card: TCGdexCardSummary, index: number, seenSlugs: Set<string>): string {
  const numStr = String(card.localId || card.id || index + 1);
  let baseSlug = `pokemon-${sanitizeSlug(setId)}-${sanitizeSlug(numStr)}-ja`;

  let uniqueSlug = baseSlug;
  let counter = 1;
  while (seenSlugs.has(uniqueSlug)) {
    counter++;
    uniqueSlug = `pokemon-${sanitizeSlug(setId)}-${sanitizeSlug(numStr)}-v${counter}-ja`;
  }
  seenSlugs.add(uniqueSlug);
  return uniqueSlug;
}

async function seedPokemonJaCatalog() {
  console.log('[Pokemon JA Ingest] Starting ingestion from api.tcgdex.net/v2/ja...');

  // 1. Get Pokemon Game ID
  const gameRows = await dbQuery<{ id: string }>(
    `SELECT id FROM games WHERE slug = 'pokemon' LIMIT 1`,
  );
  if (gameRows.length === 0) {
    throw new Error('Pokemon game record not found in games table.');
  }
  const gameId = gameRows[0].id;
  console.log(`[Pokemon JA Ingest] Pokemon Game ID: ${gameId}`);

  // 2. Fetch all Japanese sets list
  console.log('[Pokemon JA Ingest] Fetching Japanese sets list...');
  const setsRes = await fetch('https://api.tcgdex.net/v2/ja/sets');
  if (!setsRes.ok) {
    throw new Error(`Failed to fetch sets from TCGdex: ${setsRes.status} ${setsRes.statusText}`);
  }

  const setsSummaryList = (await setsRes.json()) as TCGdexSetSummary[];
  console.log(`[Pokemon JA Ingest] Found ${setsSummaryList.length} Japanese sets.`);

  let totalSetsIngested = 0;
  let totalCardsIngested = 0;

  // Process sets in batches of 5 concurrently
  const concurrency = 5;
  for (let i = 0; i < setsSummaryList.length; i += concurrency) {
    const chunk = setsSummaryList.slice(i, i + concurrency);

    await Promise.all(
      chunk.map(async (summary, chunkIdx) => {
        const overallIndex = i + chunkIdx + 1;
        try {
          const detailRes = await fetch(`https://api.tcgdex.net/v2/ja/sets/${encodeURIComponent(summary.id)}`);
          if (!detailRes.ok) {
            console.warn(`[Pokemon JA Ingest] Failed to fetch set detail for ${summary.id}: ${detailRes.status}`);
            return;
          }

          const setDetail = (await detailRes.json()) as TCGdexSetDetail;
          const setSlug = `pokemon-${sanitizeSlug(setDetail.id)}-ja`;
          const releaseDate = setDetail.releaseDate ? new Date(setDetail.releaseDate).toISOString() : null;
          const cardCount = setDetail.cards?.length || setDetail.cardCount?.total || 0;
          const setName = POKEMON_JA_SET_NAMES[setDetail.id] || `${setDetail.id} : ${setDetail.name}`;

          console.log(`[${overallIndex}/${setsSummaryList.length}] Set: "${setName}" (${setDetail.id}) [Cards: ${cardCount}]`);

          // Upsert Set
          const setRows = await dbQuery<{ id: string }>(
            `INSERT INTO sets (game_id, name, slug, release_date, card_count, ppt_set_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (game_id, slug) DO UPDATE SET
               name = EXCLUDED.name,
               release_date = EXCLUDED.release_date,
               card_count = EXCLUDED.card_count,
               ppt_set_id = EXCLUDED.ppt_set_id
             RETURNING id`,
            [gameId, setName, setSlug, releaseDate, cardCount, setDetail.id],
          );

          const setIdInDb = setRows[0].id;
          const cards = setDetail.cards || [];

          if (cards.length > 0) {
            const seenSlugs = new Set<string>();
            const formattedCards = cards.map((c, idx) => {
              const cardSlug = makeCardSlug(setDetail.id, c, idx, seenSlugs);
              const imageUrl = c.image ? `${c.image}/high.webp` : null;

              return {
                set_id: setIdInDb,
                name: c.name,
                slug: cardSlug,
                number: String(c.localId || c.id || idx + 1),
                rarity: null,
                artist: null,
                description: null,
                lore: null,
                image_url: imageUrl,
                tcg_player_id: null,
                tcgplayer_url: null,
                print_run_info: {
                  tcgdex_id: c.id,
                  set_code: setDetail.id,
                  language: 'ja',
                },
              };
            });

            // Batch insert cards in chunks of 100
            const batchSize = 100;
            for (let b = 0; b < formattedCards.length; b += batchSize) {
              const cardBatch = formattedCards.slice(b, b + batchSize);
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
                   image_url = EXCLUDED.image_url,
                   print_run_info = EXCLUDED.print_run_info`,
                [JSON.stringify(cardBatch)],
              );
            }

            // Update set card_count with actual inserted cards count
            await dbQuery(
              `UPDATE sets SET card_count = $1 WHERE id = $2`,
              [cards.length, setIdInDb],
            );

            totalCardsIngested += cards.length;
          }

          totalSetsIngested++;
        } catch (err) {
          console.error(`[Pokemon JA Ingest] Error processing set ${summary.id}:`, err);
        }
      }),
    );
  }

  console.log(`\n========================================`);
  console.log(`[Pokemon JA Ingest] Completed Successfully!`);
  console.log(`Total Japanese Sets Ingested: ${totalSetsIngested}`);
  console.log(`Total Japanese Cards Ingested: ${totalCardsIngested}`);
  console.log(`========================================\n`);
}

seedPokemonJaCatalog()
  .catch((err) => {
    console.error('[Pokemon JA Ingest] Fatal Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
