-- SnkrDunk fetcher has no identity check (lib/price-engine/snkrdunk.ts never verifies the matched product is the requested card); median disagreement vs Yuyutei is 31x across 343 comparable cards; source disabled in code, all its observations are untrustworthy.

UPDATE cards
SET last_price_fetch = NULL
WHERE id IN (
  SELECT DISTINCT card_id
  FROM price_history
  WHERE source = 'snkrdunk'
);

DELETE FROM price_history
WHERE source = 'snkrdunk';

WITH affected AS (
  SELECT
    pc.id,
    CASE
      WHEN pc.raw_prices ? 'snkrdunk' THEN
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_each(COALESCE(pc.raw_prices, '{}'::jsonb)) AS entry
            WHERE entry.key NOT IN ('market', 'snkrdunk')
              AND jsonb_typeof(entry.value) = 'number'
          ) THEN
            COALESCE(
              (
                SELECT jsonb_object_agg(entry.key, entry.value)
                FROM jsonb_each(COALESCE(pc.raw_prices, '{}'::jsonb)) AS entry
                WHERE entry.key NOT IN ('market', 'snkrdunk')
              ),
              '{}'::jsonb
            ) || jsonb_build_object(
              'market',
              (
                SELECT min((entry.value #>> '{}')::numeric)
                FROM jsonb_each(COALESCE(pc.raw_prices, '{}'::jsonb)) AS entry
                WHERE entry.key NOT IN ('market', 'snkrdunk')
                  AND jsonb_typeof(entry.value) = 'number'
              )
            )
          ELSE
            COALESCE(
              (
                SELECT jsonb_object_agg(entry.key, entry.value)
                FROM jsonb_each(COALESCE(pc.raw_prices, '{}'::jsonb)) AS entry
                WHERE entry.key NOT IN ('market', 'snkrdunk')
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
          SELECT jsonb_object_agg(grade.key, grade.value - 'snkrdunk')
          FROM jsonb_each(pc.graded_prices) AS grade
          WHERE NOT (
            grade.value ? 'snkrdunk'
            AND grade.value - 'snkrdunk' = '{}'::jsonb
          )
        ),
        '{}'::jsonb
      )
    END AS graded_prices
  FROM price_cache pc
  WHERE pc.raw_prices ? 'snkrdunk'
     OR EXISTS (
       SELECT 1
       FROM jsonb_each(COALESCE(pc.graded_prices, '{}'::jsonb)) AS grade
       WHERE grade.value ? 'snkrdunk'
     )
)
UPDATE price_cache pc
SET raw_prices = affected.raw_prices,
    graded_prices = affected.graded_prices
FROM affected
WHERE pc.id = affected.id;
