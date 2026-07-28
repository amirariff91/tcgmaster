-- Applied to prod 2026-07-28 ~07:30 UTC via MCP; mirrored here for parity.
--
-- Yuyutei's selector maps _p2/_p3/_p4 into one "manga/SP/flagship/serial" bucket and takes
-- the first survivor without verifying the card number, so sibling variants of the same base
-- card end up with byte-identical prices from a single (often sold-out serial-promo) listing.
-- Verified live: OP12-020_p2/p3/p4 all carried Y798,000 (the sold-out serial-numbered
-- Flagship Battle promo); the real in-stock parallel is Y7,980 (100x error). Purge yuyutei
-- rows for variant cards whose LATEST yuyutei raw price is byte-identical to a sibling
-- variant's and > $100 (the artifact signature; ~15 clusters at time of application).

CREATE TEMP TABLE _yuyutei_affected AS
WITH latest AS (
  SELECT DISTINCT ON (ph.card_id) ph.card_id, ph.price,
         regexp_replace(c.number, '[_-][PpRr][0-9]+$', '') AS base_num
  FROM price_history ph
  JOIN cards c ON c.id = ph.card_id
  WHERE ph.source = 'yuyutei' AND ph.grade = 'raw' AND c.number ~ '[_-][PpRr][0-9]+$'
  ORDER BY ph.card_id, ph.recorded_at DESC
)
SELECT l.card_id FROM latest l
WHERE l.price > 100
  AND EXISTS (
    SELECT 1 FROM latest l2
    WHERE l2.base_num = l.base_num AND l2.price = l.price AND l2.card_id <> l.card_id
  );

DELETE FROM price_history
WHERE source = 'yuyutei' AND card_id IN (SELECT card_id FROM _yuyutei_affected);

UPDATE cards SET last_price_fetch = NULL
WHERE id IN (SELECT card_id FROM _yuyutei_affected);

WITH shaped AS (
  SELECT pc.id,
    CASE
      WHEN pc.raw_prices ? 'yuyutei' THEN
        CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_each(COALESCE(pc.raw_prices,'{}'::jsonb)) e
            WHERE e.key NOT IN ('market','yuyutei') AND jsonb_typeof(e.value)='number'
          ) THEN
            COALESCE((SELECT jsonb_object_agg(e.key, e.value)
                      FROM jsonb_each(COALESCE(pc.raw_prices,'{}'::jsonb)) e
                      WHERE e.key NOT IN ('market','yuyutei')), '{}'::jsonb)
            || jsonb_build_object('market',
                 (SELECT min((e.value #>> '{}')::numeric)
                  FROM jsonb_each(COALESCE(pc.raw_prices,'{}'::jsonb)) e
                  WHERE e.key NOT IN ('market','yuyutei') AND jsonb_typeof(e.value)='number'))
          ELSE
            COALESCE((SELECT jsonb_object_agg(e.key, e.value)
                      FROM jsonb_each(COALESCE(pc.raw_prices,'{}'::jsonb)) e
                      WHERE e.key NOT IN ('market','yuyutei')), '{}'::jsonb)
        END
      ELSE pc.raw_prices
    END AS raw_prices
  FROM price_cache pc
  WHERE pc.card_id IN (SELECT card_id FROM _yuyutei_affected) AND pc.raw_prices ? 'yuyutei'
)
UPDATE price_cache pc SET raw_prices = shaped.raw_prices
FROM shaped WHERE pc.id = shaped.id;

UPDATE cards c
SET price_cache_ttl = sub.new_ttl
FROM (
  SELECT a.card_id AS id,
    (SELECT ROUND(ph.price * 100)::int
     FROM price_history ph
     WHERE ph.card_id = a.card_id AND ph.grade = 'raw'
     ORDER BY ph.recorded_at DESC LIMIT 1) AS new_ttl
  FROM _yuyutei_affected a
) sub
WHERE c.id = sub.id AND c.price_cache_ttl IS DISTINCT FROM sub.new_ttl;

DROP TABLE _yuyutei_affected;
