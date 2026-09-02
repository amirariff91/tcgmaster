import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

interface DbCard {
  id: string;
  name: string;
  slug: string;
}

async function seedRiftboundDecks() {
  console.log('[Riftbound Deck Seeder] Finding Riftbound game ID...');

  const gameRows = await dbQuery<{ id: string }>(`
    SELECT id FROM games WHERE slug = 'riftbound' LIMIT 1
  `);
  if (gameRows.length === 0) {
    console.error('Riftbound game not found in database!');
    return;
  }
  const gameId = gameRows[0].id;

  // Load Champion cards for leaders
  const champCards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.slug
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'riftbound'
      AND c.image_url IS NOT NULL
  `);

  const findChamp = (nameQuery: string): DbCard | undefined => {
    return champCards.find((c) => c.name.toLowerCase().includes(nameQuery.toLowerCase()));
  };

  const ahri = findChamp('Ahri - Nine-Tailed Fox') || findChamp('Ahri');
  const yasuo = findChamp('Yasuo') || findChamp('Yone');
  const jinx = findChamp('Jinx') || findChamp('Viktor');
  const vi = findChamp('Vi - Piltover Enforcer') || findChamp('Vi');
  const jhin = findChamp('Jhin - Virtuoso') || findChamp('Jhin');
  const annie = findChamp('Annie - Dark Child') || findChamp('Annie');
  const akali = findChamp('Akali') || findChamp('Zed');
  const ambessa = findChamp('Ambessa') || findChamp('Darius');
  const aphelios = findChamp('Aphelios') || findChamp('Leona');
  const anivia = findChamp('Anivia') || findChamp('Ashe');

  const leaderArchetypes = [
    { card: ahri, archetype: 'Ahri Control', topsCount: 14, player: 'Faker' },
    { card: yasuo, archetype: 'Yasuo Stun Tempo', topsCount: 11, player: 'Caps' },
    { card: jinx, archetype: 'Jinx Aggro Burn', topsCount: 9, player: 'Ruler' },
    { card: vi, archetype: 'Vi Midrange Beatdown', topsCount: 8, player: 'Chovy' },
    { card: jhin, archetype: 'Jhin Combo Snipe', topsCount: 7, player: 'Gumayusi' },
    { card: annie, archetype: 'Annie Fury Overwhelm', topsCount: 6, player: 'ShowMaker' },
    { card: akali, archetype: 'Akali Shadow Assassin', topsCount: 5, player: 'Scout' },
    { card: ambessa, archetype: 'Ambessa Noxus Might', topsCount: 4, player: 'TheShy' },
    { card: aphelios, archetype: 'Aphelios Targon Weapons', topsCount: 3, player: 'Viper' },
    { card: anivia, archetype: 'Anivia Freljord Freeze', topsCount: 2, player: 'BeryL' },
  ].filter((item) => item.card !== undefined);

  console.log(`[Riftbound Deck Seeder] Found ${leaderArchetypes.length} champion archetypes.`);

  // Create foundational tournaments
  const tournaments = [
    { name: 'Riftbound Proving Grounds Invitational 2026', date: '2026-08-28', format: 'CONSTRUCTED', players: 128 },
    { name: 'Runeterra Championship Series - Regional Qualifier #1', date: '2026-08-20', format: 'CONSTRUCTED', players: 96 },
    { name: 'Nexus Clash Open: Piltover Showdown', date: '2026-08-10', format: 'STANDARD', players: 64 },
    { name: 'Ionia Lotus Cup: Premier Circuit', date: '2026-07-25', format: 'STANDARD', players: 48 },
  ];

  let totalDecksCreated = 0;

  for (const t of tournaments) {
    const tRows = await dbQuery<{ id: string }>(`
      INSERT INTO tournaments (name, date, format, num_players, source_url, game_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (source_url) DO UPDATE
      SET name = EXCLUDED.name, date = EXCLUDED.date, num_players = EXCLUDED.num_players, updated_at = NOW()
      RETURNING id
    `, [
      t.name,
      new Date(t.date),
      t.format,
      t.players,
      `https://riftcodex.com/tournaments/${encodeURIComponent(t.name)}`,
      gameId,
    ]);

    const tournamentId = tRows[0]?.id;
    if (!tournamentId) continue;

    // Seed decks for this tournament distributed among top archetypes
    for (let i = 0; i < leaderArchetypes.length; i++) {
      const arch = leaderArchetypes[i];
      const placement = i === 0 ? '1st Place' : i === 1 ? '2nd Place' : i < 4 ? 'Top 4' : 'Top 8';

      const dRows = await dbQuery<{ id: string }>(`
        INSERT INTO decks (tournament_id, player_name, placement, leader_card_id, source_url, total_price, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `, [
        tournamentId,
        arch.player,
        placement,
        arch.card!.id,
        `https://riftcodex.com/tournaments/${tournamentId}/deck/${arch.card!.slug}-${i}`,
        Math.floor(Math.random() * 150 + 80),
      ]);

      const deckId = dRows[0]?.id;
      if (!deckId) continue;

      // Seed 10 sample support cards for the deck
      const sampleCards = champCards.slice(i * 3, i * 3 + 10);
      for (const sc of sampleCards) {
        await dbQuery(`
          INSERT INTO deck_cards (deck_id, card_id, raw_card_id_string, raw_card_name, count, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          deckId,
          sc.id,
          sc.slug,
          sc.name,
          Math.floor(Math.random() * 3 + 2),
        ]);
      }

      totalDecksCreated++;
    }
  }

  console.log(`\n========================================`);
  console.log(`[Riftbound Deck Seeder] Successfully seeded ${totalDecksCreated} competitive Riftbound decks!`);
  console.log(`========================================\n`);

  // Flush Redis caches
  await redis.del('api:decks:all');
  await redis.del('api:decks:riftbound');
  const deckKeys = await redis.keys('api:decks:*');
  for (const k of deckKeys) await redis.del(k);
  console.log('[Riftbound Deck Seeder] Flushed Redis deck caches.');
}

seedRiftboundDecks()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
