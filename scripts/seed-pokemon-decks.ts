import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

interface LimitlessTournament {
  id: string;
  name: string;
  date: string;
  format: string;
  players: number;
}

interface LimitlessStanding {
  player: string;
  name: string;
  placing: number | null;
  deck?: {
    id: string;
    name: string;
    icons?: string[];
  };
  decklist?: {
    pokemon?: Array<{ count: number; name: string; set?: string; number?: string }>;
    trainer?: Array<{ count: number; name: string; set?: string; number?: string }>;
    energy?: Array<{ count: number; name: string; set?: string; number?: string }>;
  };
}

async function seedPokemonDecks() {
  console.log('[Pokemon Decks Seeder] Fetching Pokemon game ID...');

  const gameRows = await dbQuery<{ id: string }>(`
    SELECT id FROM games WHERE slug = 'pokemon' LIMIT 1
  `);
  if (gameRows.length === 0) {
    console.error('Pokemon game not found in database!');
    return;
  }
  const gameId = gameRows[0].id;

  console.log('[Pokemon Decks Seeder] Fetching recent PTCG tournaments from Limitless...');
  const res = await fetch('https://play.limitlesstcg.com/api/tournaments?game=PTCG&limit=10', {
    headers: { 'User-Agent': 'TCGMaster/1.0' },
  });
  if (!res.ok) {
    console.error('Failed to fetch tournaments:', res.statusText);
    return;
  }
  const tournaments: LimitlessTournament[] = await res.json();
  console.log(`[Pokemon Decks Seeder] Found ${tournaments.length} tournaments.`);

  let totalDecksInserted = 0;

  for (const t of tournaments) {
    console.log(`\n[Pokemon Decks Seeder] Processing Tournament: "${t.name}" (${t.date})...`);

    // 1. Upsert tournament in database
    const tRows = await dbQuery<{ id: string }>(`
      INSERT INTO tournaments (name, date, format, num_players, source_url, game_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id
    `, [
      t.name,
      t.date ? new Date(t.date) : new Date(),
      t.format || 'STANDARD',
      t.players || 0,
      `https://play.limitlesstcg.com/tournament/${t.id}`,
      gameId,
    ]);

    const tournamentDbId = tRows[0]?.id;
    if (!tournamentDbId) continue;

    // 2. Fetch Standings / Decklists
    try {
      const standingsRes = await fetch(`https://play.limitlesstcg.com/api/tournaments/${t.id}/standings`, {
        headers: { 'User-Agent': 'TCGMaster/1.0' },
      });
      if (!standingsRes.ok) continue;
      const standings: LimitlessStanding[] = await standingsRes.json();

      // Take top 8 standings with decklists
      const topDecks = standings.filter((s) => s.decklist && (s.decklist.pokemon || s.decklist.trainer)).slice(0, 8);
      console.log(`  -> Found ${topDecks.length} top decks.`);

      for (let i = 0; i < topDecks.length; i++) {
        const s = topDecks[i];
        const placement = s.placing || (i + 1);
        const deckName = s.deck?.name || 'Standard Deck';

        // Find primary archetype pokemon for leader image
        const mainPokemon = s.decklist?.pokemon?.[0]?.name || s.deck?.name || 'Charizard ex';

        // Find matching leader card in cards table
        const leaderCardRows = await dbQuery<{ id: string }>(`
          SELECT c.id
          FROM cards c
          JOIN sets s ON s.id = c.set_id
          WHERE s.slug LIKE 'pokemon-%'
            AND c.name ILIKE $1
            AND c.image_url IS NOT NULL
          LIMIT 1
        `, [`%${mainPokemon.split(' ')[0]}%`]);

        const leaderCardId = leaderCardRows[0]?.id || null;

        // Insert Deck
        const deckRows = await dbQuery<{ id: string }>(`
          INSERT INTO decks (tournament_id, player_name, placement, leader_card_id, source_url, total_price, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          RETURNING id
        `, [
          tournamentDbId,
          s.player || s.name || `Player ${i + 1}`,
          placement,
          leaderCardId,
          `https://play.limitlesstcg.com/tournament/${t.id}/player/${s.player}`,
          null,
        ]);

        const deckDbId = deckRows[0]?.id;
        if (!deckDbId) continue;

        // Insert Deck Cards
        const allCards = [
          ...(s.decklist?.pokemon || []),
          ...(s.decklist?.trainer || []),
          ...(s.decklist?.energy || []),
        ];

        for (const dc of allCards) {
          const cardCount = dc.count || 1;
          const cardName = dc.name;

          // Find matching card ID (prioritize lowest-cost base print)
          const matchedCard = await dbQuery<{ id: string }>(`
            SELECT c.id
            FROM cards c
            JOIN sets s ON s.id = c.set_id
            LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
            WHERE s.slug LIKE 'pokemon-%'
              AND LOWER(TRIM(c.name)) = LOWER(TRIM($1))
              AND c.name NOT ILIKE '%Alternate Art%'
              AND c.name NOT ILIKE '%Manga%'
              AND c.name NOT ILIKE '%Special Card%'
            ORDER BY
              (cpc.headline_cents IS NOT NULL AND cpc.headline_cents > 0) DESC,
              cpc.headline_cents ASC NULLS LAST,
              c.id ASC
            LIMIT 1
          `, [cardName]);

          await dbQuery(`
            INSERT INTO deck_cards (deck_id, card_id, raw_card_id_string, raw_card_name, count, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [
            deckDbId,
            matchedCard[0]?.id || null,
            dc.set ? `${dc.set}-${dc.number}` : null,
            cardName,
            cardCount,
          ]);
        }

        totalDecksInserted++;
      }
    } catch (err) {
      console.error(`Error processing standings for tournament ${t.id}:`, err);
    }
  }

  console.log(`\n========================================`);
  console.log(`[Pokemon Decks Seeder] Ingested ${totalDecksInserted} competitive Pokemon decks!`);
  console.log(`========================================\n`);

  // Flush Redis caches
  await redis.del('api:decks:all');
  await redis.del('api:decks:pokemon');
  console.log('[Pokemon Decks Seeder] Flushed Redis deck caches.');
}

seedPokemonDecks()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
