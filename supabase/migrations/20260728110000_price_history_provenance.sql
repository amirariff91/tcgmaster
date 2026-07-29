-- Sources quote different quantities in different currencies:
-- TCGPlayer: sales-derived market USD; PriceCharting: sold-listing GUIDE value USD
-- (their aggregation method is unpublished — 'sold_guide', deliberately not 'median');
-- Yuyutei: JP retail sell JPY; Cardrush: lowest listing JPY;
-- SnkrDunk: marketplace ask USD; ppt-api: market USD.
-- The meaning of each observation must be recorded at write time.
-- Any source values not listed here (ebay, pwcc, goldin, heritage, user-submitted,
-- tcgrepublic) have zero rows.

CREATE TYPE price_kind AS ENUM ('market','lowest_listing','retail_sell','sold_guide','marketplace_ask');

ALTER TABLE price_history
  ADD COLUMN currency CHAR(3),
  ADD COLUMN price_native NUMERIC(12,2),
  ADD COLUMN price_kind price_kind;

-- price_native backfill: for USD-native sources the stored price IS the native amount.
-- For JPY sources (yuyutei, cardrush) price_native stays NULL: those rows were converted
-- at a hardcoded rate that changed over time, and the applied constant per row is not
-- recoverable. Do not fake it by multiplying the existing USD value back.
-- currency records the source's native quote currency; price remains USD-as-converted.

UPDATE price_history
SET price_kind = 'market', currency = 'USD', price_native = price
WHERE source = 'tcgplayer';

UPDATE price_history
SET price_kind = 'sold_guide', currency = 'USD', price_native = price
WHERE source = 'pricecharting';

UPDATE price_history
SET price_kind = 'retail_sell', currency = 'JPY'
WHERE source = 'yuyutei';

UPDATE price_history
SET price_kind = 'lowest_listing', currency = 'JPY'
WHERE source = 'cardrush';

UPDATE price_history
SET price_kind = 'marketplace_ask', currency = 'USD', price_native = price
WHERE source = 'snkrdunk';

UPDATE price_history
SET price_kind = 'market', currency = 'USD', price_native = price
WHERE source = 'ppt-api';

-- Deployed writers do not yet populate these columns (the shared write path that does is a
-- later change), and residual one-shot scripts insert bare rows too. This trigger derives
-- provenance from source at the database boundary so no post-migration row lands NULL.
-- Writers that DO pass explicit values win — the trigger only fills NULLs.
CREATE FUNCTION price_history_fill_provenance() RETURNS trigger AS $$
BEGIN
  IF NEW.price_kind IS NULL THEN
    NEW.price_kind := CASE NEW.source::text
      WHEN 'tcgplayer'     THEN 'market'::price_kind
      WHEN 'pricecharting' THEN 'sold_guide'::price_kind
      WHEN 'yuyutei'       THEN 'retail_sell'::price_kind
      WHEN 'cardrush'      THEN 'lowest_listing'::price_kind
      WHEN 'snkrdunk'      THEN 'marketplace_ask'::price_kind
      WHEN 'ppt-api'       THEN 'market'::price_kind
      ELSE NULL
    END;
  END IF;
  IF NEW.currency IS NULL THEN
    NEW.currency := CASE
      WHEN NEW.source::text IN ('yuyutei', 'cardrush') THEN 'JPY'
      ELSE 'USD'
    END;
  END IF;
  IF NEW.price_native IS NULL AND NEW.currency = 'USD' THEN
    NEW.price_native := NEW.price;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER price_history_fill_provenance
BEFORE INSERT ON price_history
FOR EACH ROW EXECUTE FUNCTION price_history_fill_provenance();

-- SELECT source, count(*) FROM price_history WHERE price_kind IS NULL GROUP BY 1;  -- expect zero rows
