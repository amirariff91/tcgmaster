-- Sources quote different quantities in different currencies:
-- TCGPlayer: sales-derived market USD; PriceCharting: sold-listing guide value USD;
-- Yuyutei: JP retail sell JPY; Cardrush: lowest listing JPY;
-- SnkrDunk: marketplace ask USD; ppt-api: market USD.
-- The meaning of each observation must be recorded at write time.
-- Any source values not listed here (ebay, pwcc, goldin, heritage, user-submitted,
-- tcgrepublic) have zero rows.

CREATE TYPE price_kind AS ENUM ('market','lowest_listing','retail_sell','sold_median','marketplace_ask');

ALTER TABLE price_history
  ADD COLUMN currency CHAR(3),
  ADD COLUMN price_native NUMERIC(12,2),
  ADD COLUMN price_kind price_kind;

-- price_native stays NULL for all historical rows: JPY rows were converted at a
-- hardcoded rate that changed over time, and the applied constant per row is not
-- recoverable. Do not fake it by multiplying the existing USD value back.
-- currency records the source's native quote currency; price remains USD-as-converted.

UPDATE price_history
SET price_kind = 'market', currency = 'USD'
WHERE source = 'tcgplayer';

UPDATE price_history
SET price_kind = 'sold_median', currency = 'USD'
WHERE source = 'pricecharting';

UPDATE price_history
SET price_kind = 'retail_sell', currency = 'JPY'
WHERE source = 'yuyutei';

UPDATE price_history
SET price_kind = 'lowest_listing', currency = 'JPY'
WHERE source = 'cardrush';

UPDATE price_history
SET price_kind = 'marketplace_ask', currency = 'USD'
WHERE source = 'snkrdunk';

UPDATE price_history
SET price_kind = 'market', currency = 'USD'
WHERE source = 'ppt-api';

-- SELECT source, count(*) FROM price_history WHERE price_kind IS NULL GROUP BY 1;  -- expect zero rows
