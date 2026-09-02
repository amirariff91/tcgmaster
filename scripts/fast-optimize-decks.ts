import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

async function fastOptimizeDecks() {
  console.log('[Fast Deck Optimizer] 1. Finding cheapest card mapping for all card identities...');

  // 1. Build an in-memory map of (game_id, clean_number) -> cheapest_card_id
  const allCards = await dbQuery<{
    id: string;
    number: string;
    name: string;
    slug: string;
    game_id: string;
    headline_cents: number | null;
  }>(`
    SELECT
      c.id,
      c.number,
      c.name,
      c.slug,
      s.game_id,
      cpc.headline_cents
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
    WHERE c.number IS NOT NULL AND c.number != ''
    ORDER BY
      (cpc.headline_cents IS NOT NULL AND cpc.headline_cents > 0) DESC,
      cpc.headline_cents ASC NULLS LAST,
      c.name NOT ILIKE '%Alternate Art%' DESC,
      c.name NOT ILIKE '%Manga%' DESC,
      c.name NOT ILIKE '%Signature%' DESC,
      c.id ASC
  `);

  console.log(`[Fast Deck Optimizer] Loaded ${allCards.length} cards from database.`);

  const cheapestByGameAndNumber = new Map<string, string>();

  for (const c of allCards) {
    const cleanNum = c.number.replace(/[_-][pr]\d+/gi, '').trim().toUpperCase();
    const key = `${c.game_id}:${cleanNum}`;
    if (!cheapestByGameAndNumber.has(key)) {
      cheapestByGameAndNumber.set(key, c.id);
    }
  }

  console.log(`[Fast Deck Optimizer] Indexed ${cheapestByGameAndNumber.size} unique base card numbers.`);

  // 2. Fetch all deck_cards and update in batches
  const deckCards = await dbQuery<{
    id: string;
    card_id: string | null;
    raw_card_name: string | null;
    raw_card_id_string: string | null;
    game_id: string;
  }>(`
    SELECT
      dc.id,
      dc.card_id,
      dc.raw_card_name,
      dc.raw_card_id_string,
      t.game_id
    FROM deck_cards dc
    JOIN decks d ON d.id = dc.deck_id
    JOIN tournaments t ON t.id = d.tournament_id
  `);

  console.log(`[Fast Deck Optimizer] Auditing ${deckCards.length} deck cards...`);

  const updates: Array<{ id: string; cardId: string }> = [];

  for (const dc of deckCards) {
    const raw = dc.raw_card_id_string || dc.raw_card_name;
    if (!raw) continue;
    const cleanNum = raw.replace(/[_-][pr]\d+/gi, '').trim().toUpperCase();
    const key = `${dc.game_id}:${cleanNum}`;

    const cheapestId = cheapestByGameAndNumber.get(key);
    if (cheapestId && cheapestId !== dc.card_id) {
      updates.push({ id: dc.id, cardId: cheapestId });
    }
  }

  console.log(`[Fast Deck Optimizer] Applying ${updates.length} remappings...`);

  // Batch update
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    for (const u of batch) {
      await dbQuery('UPDATE deck_cards SET card_id = $1 WHERE id = $2', [u.cardId, u.id]);
    }
  }

  // 3. Recalculate all deck total_price
  console.log('[Fast Deck Optimizer] Recalculating all deck total_prices...');
  await dbQuery(`
    UPDATE decks d
    SET total_price = sub.new_total,
        updated_at = NOW()
    FROM (
      SELECT
        dc.deck_id,
        round(sum(COALESCE(cpc.headline_cents, 100) * dc.count) / 100.0, 2) AS new_total
      FROM deck_cards dc
      LEFT JOIN card_price_current cpc ON cpc.card_id = dc.card_id
      GROUP BY dc.deck_id
    ) sub
    WHERE d.id = sub.deck_id
  `);

  // 4. Flush Redis deck caches
  const deckKeys = await redis.keys('api:decks:*');
  for (const k of deckKeys) await redis.del(k);
  await redis.del('api:decks:all');

  console.log('[Fast Deck Optimizer] Done! All deck prices optimized to lowest common prints.');
}

fastOptimizeDecks()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
