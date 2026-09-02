import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

interface DbCard {
  id: string;
  name: string;
  slug: string;
}

async function seedMonstaGalaxyDecks() {
  console.log('[Monsta Galaxy Deck Seeder] Finding Monsta Galaxy game ID...');

  const gameRows = await dbQuery<{ id: string }>(`
    SELECT id FROM games WHERE slug = 'boboiboy' LIMIT 1
  `);
  if (gameRows.length === 0) {
    console.error('Monsta Galaxy game not found in database!');
    return;
  }
  const gameId = gameRows[0].id;

  // Load all character cards
  const allCards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.slug
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'boboiboy'
  `);

  console.log(`[Monsta Galaxy Deck Seeder] Loaded ${allCards.length} cards from database.`);

  const findCard = (nameQuery: string): DbCard | undefined => {
    return allCards.find((c) => c.name.toLowerCase().includes(nameQuery.toLowerCase()));
  };

  const halilintar = findCard('Halilintar');
  const solar = findCard('Solar');
  const frostfire = findCard('Frostfire');
  const supra = findCard('Supra') || findCard('Fusion');
  const fang = findCard('Fang');
  const yaya = findCard('Yaya');
  const gopal = findCard('Gopal');
  const retakka = findCard('Retak');
  const glacier = findCard('Glacier') || findCard('Ais');
  const satria = findCard('Satria') || findCard('BoBoiBoy');

  const leaderArchetypes = [
    { card: halilintar, archetype: 'BoBoiBoy Halilintar Aggro', topsCount: 15, player: 'Hafiz' },
    { card: solar, archetype: 'BoBoiBoy Solar Eclipse Burn', topsCount: 12, player: 'Faizal' },
    { card: frostfire, archetype: 'BoBoiBoy Frostfire Burst', topsCount: 10, player: 'Danial' },
    { card: supra, archetype: 'BoBoiBoy Supra Fusion Combo', topsCount: 8, player: 'Irfan' },
    { card: fang, archetype: 'Fang Shadow Beast Control', topsCount: 7, player: 'Zikri' },
    { card: yaya, archetype: 'Yaya Gravity Heavy Strike', topsCount: 6, player: 'Syahmi' },
    { card: gopal, archetype: 'Gopal Transmutation Stall', topsCount: 5, player: 'Aiman' },
    { card: retakka, archetype: 'Retak\'ka Dark Elemental Might', topsCount: 4, player: 'Khairul' },
    { card: glacier, archetype: 'BoBoiBoy Glacier Freeze Defense', topsCount: 3, player: 'Amir' },
    { card: satria, archetype: 'BoBoiBoy Satria Seven Elements', topsCount: 2, player: 'Farhan' },
  ].filter((item) => item.card !== undefined);

  console.log(`[Monsta Galaxy Deck Seeder] Found ${leaderArchetypes.length} leader archetypes.`);

  const circuits = [
    { name: 'Monsta Grand Championship 2026 (Kuala Lumpur)', date: '2026-08-15', players: 128 },
    { name: 'Monsta Galaxy Regional Cup (Putrajaya)', date: '2026-08-22', players: 64 },
    { name: 'Monsta Battle Clash Masters (Johor Bahru)', date: '2026-08-29', players: 64 },
    { name: 'Galaxy Card Elite Invitational (Penang)', date: '2026-09-01', players: 32 },
  ];

  let totalDecksCreated = 0;

  for (const circuit of circuits) {
    console.log(`\n[Monsta Galaxy Deck Seeder] Seeding Circuit: "${circuit.name}"...`);

    const circuitSlug = circuit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const tRows = await dbQuery<{ id: string }>(`
      INSERT INTO tournaments (game_id, name, date, format, num_players, source_url, created_at, updated_at)
      VALUES ($1, $2, $3, 'Standard', $4, $5, NOW(), NOW())
      RETURNING id
    `, [gameId, circuit.name, circuit.date, circuit.players, `https://galaxycard.monsta.com/events/${circuitSlug}`]);

    const tournamentId = tRows[0].id;

    for (let i = 0; i < leaderArchetypes.length; i++) {
      const arch = leaderArchetypes[i];
      const leaderCard = arch.card!;
      const placement = i + 1;

      // Realistic budget deck price (~$20 - $45 USD / ~RM 90 - RM 200)
      const basePrice = Math.round((20 + Math.random() * 25) * 100) / 100;

      const dRows = await dbQuery<{ id: string }>(`
        INSERT INTO decks (tournament_id, player_name, placement, leader_card_id, source_url, total_price, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `, [
        tournamentId,
        arch.player,
        placement,
        leaderCard.id,
        `https://galaxycard.monsta.com/decklists/${tournamentId}-${i + 1}-${leaderCard.slug}`,
        basePrice,
      ]);

      const deckId = dRows[0].id;

      // Fill 50 cards for decklist
      const sampleCards = allCards.slice(0, 15);
      for (const card of sampleCards) {
        await dbQuery(`
          INSERT INTO deck_cards (deck_id, card_id, raw_card_id_string, raw_card_name, count, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          deckId,
          card.id,
          card.slug,
          card.name,
          Math.floor(Math.random() * 3) + 2,
        ]);
      }

      totalDecksCreated++;
    }
  }

  console.log(`\n========================================`);
  console.log(`[Monsta Galaxy Deck Seeder] Successfully seeded ${totalDecksCreated} competitive Monsta Galaxy decks!`);
  console.log(`========================================\n`);

  // Flush Redis caches
  const deckKeys = await redis.keys('api:decks:*');
  for (const k of deckKeys) await redis.del(k);
  await redis.del('api:decks:all');
  console.log('[Monsta Galaxy Deck Seeder] Flushed Redis deck caches.');
}

seedMonstaGalaxyDecks()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
