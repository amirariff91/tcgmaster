-- Add URL columns to cards table for scraper tracking
ALTER TABLE cards 
  ADD COLUMN IF NOT EXISTS tcgplayer_url TEXT,
  ADD COLUMN IF NOT EXISTS snkrdunk_url TEXT,
  ADD COLUMN IF NOT EXISTS yuyutei_url TEXT,
  ADD COLUMN IF NOT EXISTS cardrush_url TEXT;

-- We don't need a new price history table because 'price_history' already exists 
-- with a 'source' column. We will use 'source' = 'tcgplayer', 'snkrdunk', etc.
