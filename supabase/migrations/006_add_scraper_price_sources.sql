-- Add scraper price sources to the price_source enum.
-- Fixes live scraper insert failures (22P02: invalid input value for enum price_source: "pricecharting").
-- `cardrush` and `tcgrepublic` already existed in production (added out-of-band, not previously
-- captured in a migration file); included here with IF NOT EXISTS to reconcile repo/DB drift so a
-- fresh rebuild matches production. Only `pricecharting` is a new value at time of writing.
ALTER TYPE price_source ADD VALUE IF NOT EXISTS 'cardrush';
ALTER TYPE price_source ADD VALUE IF NOT EXISTS 'tcgrepublic';
ALTER TYPE price_source ADD VALUE IF NOT EXISTS 'pricecharting';
