import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

async function fastOptimizeDecks() {
  console.log('[Fast Deck Optimizer] 1. Indexing cheapest prints across all card names and numbers...');

  // Index 1: Cheapest card by (game_id, clean_number)
  const allCardsByNumber = await dbQuery<{
    id: string;
    number: string;
    name: string;
    game_id: string;
    headline_cents: number | null;
  }>(`
    SELECT
      c.id,
      c.number,
      c.name,
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
      c.name NOT ILIKE '%Special Card%' DESC,
      c.id ASC
  `);

  const cheapestByNumber = new Map<string, { id: string; headline_cents: number | null }>();
  for (const c of allCardsByNumber) {
    const cleanNum = c.number.replace(/[_-][pr]\d+/gi, '').trim().toUpperCase();
    const key = `${c.game_id}:${cleanNum}`;
    if (!cheapestByNumber.has(key)) {
      cheapestByNumber.set(key, { id: c.id, headline_cents: c.headline_cents });
    }
  }

  // Index 2: Cheapest card by (game_id, clean_name) for generic/reprinted tournament entries
  const allCardsByName = await dbQuery<{
    id: string;
    name: string;
    game_id: string;
    headline_cents: number | null;
  }>(`
    SELECT DISTINCT ON (s.game_id, LOWER(TRIM(c.name)))
      c.id,
      c.name,
      s.game_id,
      cpc.headline_cents
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN card_price_current cpc ON cpc.card_id = c.id
    WHERE cpc.headline_cents > 0
      AND c.name NOT ILIKE '%Alternate Art%'
      AND c.name NOT ILIKE '%Manga%'
      AND c.name NOT ILIKE '%Signature%'
      AND c.name NOT ILIKE '%Special Card%'
    ORDER BY
      s.game_id,
      LOWER(TRIM(c.name)),
      cpc.headline_cents ASC,
      c.id ASC
  `);

  const cheapestByName = new Map<string, { id: string; headline_cents: number }>();
  for (const c of allCardsByName) {
    const key = `${c.game_id}:${c.name.trim().toLowerCase()}`;
    cheapestByName.set(key, { id: c.id, headline_cents: c.headline_cents! });
  }

  console.log(`[Fast Deck Optimizer] Indexed ${cheapestByNumber.size} number keys and ${cheapestByName.size} name keys.`);

  // 2. Audit all deck_cards
  const deckCards = await dbQuery<{
    id: string;
    card_id: string | null;
    raw_card_name: string | null;
    raw_card_id_string: string | null;
    current_name: string | null;
    current_headline_cents: number | null;
    game_id: string;
  }>(`
    SELECT
      dc.id,
      dc.card_id,
      dc.raw_card_name,
      dc.raw_card_id_string,
      c.name AS current_name,
      cpc.headline_cents AS current_headline_cents,
      t.game_id
    FROM deck_cards dc
    JOIN decks d ON d.id = dc.deck_id
    JOIN tournaments t ON t.id = d.tournament_id
    LEFT JOIN cards c ON c.id = dc.card_id
    LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
  `);

  console.log(`[Fast Deck Optimizer] Auditing ${deckCards.length} deck cards...`);

  const updates: Array<{ id: string; cardId: string }> = [];

  for (const dc of deckCards) {
    const rawName = dc.raw_card_name || dc.current_name;
    const nameKey = rawName ? `${dc.game_id}:${rawName.trim().toLowerCase()}` : null;
    const cheapestNameMatch = nameKey ? cheapestByName.get(nameKey) : null;

    const rawId = dc.raw_card_id_string;
    const numKey = rawId ? `${dc.game_id}:${rawId.replace(/[_-][pr]\d+/gi, '').trim().toUpperCase()}` : null;
    const cheapestNumMatch = numKey ? cheapestByNumber.get(numKey) : null;

    let targetCardId: string | null = null;

    // Prioritize name-based cheapest match if current price is inflated or missing
    if (cheapestNameMatch && (!dc.current_headline_cents || cheapestNameMatch.headline_cents < dc.current_headline_cents)) {
      targetCardId = cheapestNameMatch.id;
    } else if (cheapestNumMatch) {
      targetCardId = cheapestNumMatch.id;
    } else if (cheapestNameMatch) {
      targetCardId = cheapestNameMatch.id;
    }

    if (targetCardId && targetCardId !== dc.card_id) {
      updates.push({ id: dc.id, cardId: targetCardId });
    }
  }

  console.log(`[Fast Deck Optimizer] Applying ${updates.length} remappings to cheapest base prints in bulk...`);

  // Bulk update using unnest
  for (let i = 0; i < updates.length; i += 500) {
    const batch = updates.slice(i, i + 500);
    const ids = batch.map(b => b.id);
    const cardIds = batch.map(b => b.cardId);

    await dbQuery(`
      UPDATE deck_cards dc
      SET card_id = u.card_id
      FROM unnest($1::uuid[], $2::uuid[]) AS u(id, card_id)
      WHERE dc.id = u.id
    `, [ids, cardIds]);
    console.log(`  -> Remapped ${Math.min(i + 500, updates.length)} / ${updates.length}...`);
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
