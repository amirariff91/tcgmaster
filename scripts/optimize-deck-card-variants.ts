import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

interface DeckCardRow {
  id: string;
  deck_id: string;
  card_id: string | null;
  raw_card_name: string | null;
  raw_card_id_string: string | null;
  current_card_name: string | null;
  current_number: string | null;
  current_slug: string | null;
  current_price_cents: number | null;
  game_slug: string;
}

interface CheapestCandidate {
  id: string;
  name: string;
  slug: string;
  number: string;
  headline_cents: number | null;
}

async function optimizeDeckCardVariants() {
  console.log('[Deck Variant Optimizer] Loading all deck cards from database...');

  const deckCards = await dbQuery<DeckCardRow>(`
    SELECT
      dc.id,
      dc.deck_id,
      dc.card_id,
      dc.raw_card_name,
      dc.raw_card_id_string,
      c.name AS current_card_name,
      c.number AS current_number,
      c.slug AS current_slug,
      cpc.headline_cents AS current_price_cents,
      g.slug AS game_slug
    FROM deck_cards dc
    JOIN decks d ON d.id = dc.deck_id
    JOIN tournaments t ON t.id = d.tournament_id
    JOIN games g ON g.id = t.game_id
    LEFT JOIN cards c ON c.id = dc.card_id
    LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
    ORDER BY dc.id ASC
  `);

  console.log(`[Deck Variant Optimizer] Processing ${deckCards.length} deck card entries...`);

  // Cache cheapest card mappings by [game_slug:clean_identifier]
  const cheapestCache = new Map<string, string>();
  let remappedCount = 0;

  for (const dc of deckCards) {
    const rawId = dc.raw_card_name || dc.raw_card_id_string || dc.current_number || dc.current_slug;
    if (!rawId) continue;

    // Clean number (e.g. "OP14-119_p2" -> "OP14-119", "fb04-012_p1" -> "fb04-012")
    const cleanNum = rawId.replace(/[_-][pr]\d+/gi, '').trim();
    const cacheKey = `${dc.game_slug}:${cleanNum.toLowerCase()}`;

    let cheapestId = cheapestCache.get(cacheKey);

    if (!cheapestId) {
      // Find all functional variants with prices for this game and card identifier
      const candidates = await dbQuery<CheapestCandidate>(`
        SELECT
          c.id,
          c.name,
          c.slug,
          c.number,
          cpc.headline_cents
        FROM cards c
        JOIN sets s ON s.id = c.set_id
        JOIN games g ON g.id = s.game_id
        LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
        WHERE g.slug = $1
          AND (
            c.number = $2
            OR c.number ILIKE $3
            OR c.slug ILIKE $4
          )
        ORDER BY
          (cpc.headline_cents IS NOT NULL AND cpc.headline_cents > 0) DESC,
          cpc.headline_cents ASC NULLS LAST,
          c.name NOT ILIKE '%Alternate Art%' DESC,
          c.name NOT ILIKE '%Manga%' DESC,
          c.name NOT ILIKE '%Signature%' DESC,
          c.id ASC
        LIMIT 1
      `, [
        dc.game_slug,
        cleanNum,
        `${cleanNum}%`,
        `%${cleanNum.toLowerCase().replace(/[^a-z0-9]/g, '-')}%`,
      ]);

      if (candidates.length > 0) {
        cheapestId = candidates[0].id;
        cheapestCache.set(cacheKey, cheapestId);
      }
    }

    if (cheapestId && cheapestId !== dc.card_id) {
      await dbQuery(`
        UPDATE deck_cards
        SET card_id = $1
        WHERE id = $2
      `, [cheapestId, dc.id]);
      remappedCount++;
    }
  }

  console.log(`[Deck Variant Optimizer] Remapped ${remappedCount} deck cards to their lowest-cost functional print.`);

  // Recalculate total_price for all decks
  console.log('[Deck Variant Optimizer] Recalculating total_price for all decks...');
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

  console.log('[Deck Variant Optimizer] Successfully updated all deck total values!');

  // Flush Redis caches
  const deckKeys = await redis.keys('api:decks:*');
  for (const k of deckKeys) await redis.del(k);
  await redis.del('api:decks:all');
  console.log('[Deck Variant Optimizer] Flushed Redis deck caches.');
}

optimizeDeckCardVariants()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
