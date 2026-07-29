-- Variant guard deployed 2026-07-27T09:00Z stopped PriceCharting matching suffixed variant
-- cards; rows written before that for suffixed cards are wrong-product matches (an earlier
-- purge ran before the deploy, so a gap window re-poisoned cards). Because the guard now
-- (correctly) refuses variants, NO pricecharting-derived value on a suffixed card is
-- trustworthy — this migration purges the history rows AND the derived state
-- (price_cache keys, cards.price_cache_ttl) that would otherwise keep serving the
-- poisoned value to search ranking and cache-backed surfaces indefinitely.
--
-- Dry-run first:
-- SELECT count(DISTINCT ph.card_id), count(*) FROM price_history ph JOIN cards c ON c.id = ph.card_id WHERE ph.source = 'pricecharting' AND c.number ~ '[_-][PpRr][0-9]+$' AND ph.recorded_at < '2026-07-27T09:00:00Z';

-- 1. Send affected cards to the front of the scrape queue.
UPDATE cards
SET last_price_fetch = NULL
WHERE id IN (
  SELECT c.id
  FROM cards c
  JOIN price_history ph ON ph.card_id = c.id
  WHERE ph.source = 'pricecharting'
    AND c.number ~ '[_-][PpRr][0-9]+$'
    AND ph.recorded_at < '2026-07-27T09:00:00Z'
);

-- 2. Purge the wrong-product observations.
DELETE FROM price_history ph
USING cards c
WHERE c.id = ph.card_id
  AND ph.source = 'pricecharting'
  AND c.number ~ '[_-][PpRr][0-9]+$'
  AND ph.recorded_at < '2026-07-27T09:00:00Z';

-- 3. Strip pricecharting keys from price_cache for suffixed cards and recompute the
--    'market' key from the remaining source-keyed values (drop it if none remain).
WITH affected AS (
  SELECT
    pc.id,
    CASE
      WHEN pc.raw_prices ? 'pricecharting' THEN
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_each(COALESCE(pc.raw_prices, '{}'::jsonb)) AS entry
            WHERE entry.key NOT IN ('market', 'pricecharting')
              AND jsonb_typeof(entry.value) = 'number'
          ) THEN
            COALESCE(
              (
                SELECT jsonb_object_agg(entry.key, entry.value)
                FROM jsonb_each(COALESCE(pc.raw_prices, '{}'::jsonb)) AS entry
                WHERE entry.key NOT IN ('market', 'pricecharting')
              ),
              '{}'::jsonb
            ) || jsonb_build_object(
              'market',
              (
                SELECT min((entry.value #>> '{}')::numeric)
                FROM jsonb_each(COALESCE(pc.raw_prices, '{}'::jsonb)) AS entry
                WHERE entry.key NOT IN ('market', 'pricecharting')
                  AND jsonb_typeof(entry.value) = 'number'
              )
            )
          ELSE
            COALESCE(
              (
                SELECT jsonb_object_agg(entry.key, entry.value)
                FROM jsonb_each(COALESCE(pc.raw_prices, '{}'::jsonb)) AS entry
                WHERE entry.key NOT IN ('market', 'pricecharting')
              ),
              '{}'::jsonb
            )
        END
      ELSE pc.raw_prices
    END AS raw_prices,
    CASE
      WHEN pc.graded_prices IS NULL THEN NULL
      ELSE COALESCE(
        (
          SELECT jsonb_object_agg(grade.key, grade.value - 'pricecharting')
          FROM jsonb_each(pc.graded_prices) AS grade
          WHERE NOT (
            grade.value ? 'pricecharting'
            AND grade.value - 'pricecharting' = '{}'::jsonb
          )
        ),
        '{}'::jsonb
      )
    END AS graded_prices
  FROM price_cache pc
  JOIN cards c ON c.id = pc.card_id
  WHERE c.number ~ '[_-][PpRr][0-9]+$'
    AND (
      pc.raw_prices ? 'pricecharting'
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(COALESCE(pc.graded_prices, '{}'::jsonb)) AS grade
        WHERE grade.value ? 'pricecharting'
      )
    )
)
UPDATE price_cache pc
SET raw_prices = affected.raw_prices,
    graded_prices = affected.graded_prices
FROM affected
WHERE pc.id = affected.id;

-- 4. Recompute cards.price_cache_ttl (headline cents; feeds search rank/sort and
--    RelatedCards) for suffixed cards from the newest SURVIVING raw observation,
--    NULL when none survives. Without this, a purged card keeps ranking on the
--    poisoned value because no scraper will re-price a variant it refuses to match.
UPDATE cards c
SET price_cache_ttl = sub.new_ttl
FROM (
  SELECT c2.id,
    (
      SELECT ROUND(ph.price * 100)::int
      FROM price_history ph
      WHERE ph.card_id = c2.id
        AND ph.grade = 'raw'
      ORDER BY ph.recorded_at DESC
      LIMIT 1
    ) AS new_ttl
  FROM cards c2
  WHERE c2.number ~ '[_-][PpRr][0-9]+$'
) sub
WHERE c.id = sub.id
  AND c.price_cache_ttl IS DISTINCT FROM sub.new_ttl;
