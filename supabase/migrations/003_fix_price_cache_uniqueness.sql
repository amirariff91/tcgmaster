-- Fix price_cache upserts for base-card pricing
-- Problem: UNIQUE(card_id, variant_id) allows multiple rows when variant_id is NULL,
-- causing stale/incorrect reads and upsert misses.

-- 1) Keep only the newest cache row per card_id
WITH ranked AS (
  SELECT
    id,
    card_id,
    ROW_NUMBER() OVER (
      PARTITION BY card_id
      ORDER BY fetched_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM price_cache
)
DELETE FROM price_cache p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- 2) Enforce one cache row per card (base-card pricing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'price_cache_card_id_unique'
  ) THEN
    ALTER TABLE price_cache
      ADD CONSTRAINT price_cache_card_id_unique UNIQUE (card_id);
  END IF;
END $$;
