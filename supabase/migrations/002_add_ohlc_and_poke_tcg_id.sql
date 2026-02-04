-- TCGMaster OHLC Price History & Pokemon TCG API Integration
-- Migration: Add OHLC price history table and Pokemon TCG API ID column

-- ============================================
-- ADD POKEMON TCG API ID TO CARDS TABLE
-- ============================================

-- Add poke_tcg_id column for Pokemon TCG API card IDs
ALTER TABLE cards ADD COLUMN IF NOT EXISTS poke_tcg_id VARCHAR(50);

-- Add image_fetch_attempts for retry tracking
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_fetch_attempts INTEGER DEFAULT 0;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_cards_poke_tcg_id ON cards(poke_tcg_id);
CREATE INDEX IF NOT EXISTS idx_cards_needs_image ON cards(local_image_url) WHERE local_image_url IS NULL;

-- ============================================
-- OHLC PRICE HISTORY TABLE
-- ============================================

-- Drop if exists for clean migration (development only)
DROP TABLE IF EXISTS price_history_ohlc;

-- Create OHLC price history table
CREATE TABLE price_history_ohlc (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  grading_company_id UUID REFERENCES grading_companies(id),
  grade VARCHAR(10) DEFAULT 'raw', -- 'raw', '7', '8', '9', '10', etc.

  -- Period info
  period_start TIMESTAMPTZ NOT NULL,
  period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),

  -- OHLC data
  open_price DECIMAL(12,2),
  high_price DECIMAL(12,2),
  low_price DECIMAL(12,2),
  close_price DECIMAL(12,2),

  -- Volume (number of sales in period)
  volume INTEGER DEFAULT 0,

  -- Metadata
  is_generated BOOLEAN DEFAULT false, -- True for synthetic/mock data
  source VARCHAR(50) DEFAULT 'calculated', -- 'calculated', 'imported', 'generated'
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint to prevent duplicates
  UNIQUE(card_id, variant_id, grading_company_id, grade, period_start, period_type)
);

-- Indexes for efficient queries
CREATE INDEX idx_ohlc_card_grade_period
ON price_history_ohlc(card_id, grade, period_start DESC);

CREATE INDEX idx_ohlc_period_type
ON price_history_ohlc(period_type, period_start DESC);

CREATE INDEX idx_ohlc_card_variant
ON price_history_ohlc(card_id, variant_id);

-- Composite index for typical queries (card + grade + date range)
CREATE INDEX idx_ohlc_card_grade_range
ON price_history_ohlc(card_id, grade, period_type, period_start);

-- ============================================
-- HELPER FUNCTION: Aggregate daily to weekly
-- ============================================

CREATE OR REPLACE FUNCTION aggregate_daily_to_weekly(
  p_card_id UUID,
  p_grade VARCHAR(10) DEFAULT 'raw',
  p_variant_id UUID DEFAULT NULL,
  p_grading_company_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  rows_inserted INTEGER := 0;
BEGIN
  INSERT INTO price_history_ohlc (
    card_id, variant_id, grading_company_id, grade,
    period_start, period_type,
    open_price, high_price, low_price, close_price, volume,
    is_generated, source
  )
  SELECT
    card_id,
    variant_id,
    grading_company_id,
    grade,
    date_trunc('week', period_start) AS period_start,
    'weekly' AS period_type,
    (array_agg(open_price ORDER BY period_start))[1] AS open_price,
    MAX(high_price) AS high_price,
    MIN(low_price) AS low_price,
    (array_agg(close_price ORDER BY period_start DESC))[1] AS close_price,
    SUM(volume) AS volume,
    false AS is_generated,
    'calculated' AS source
  FROM price_history_ohlc
  WHERE card_id = p_card_id
    AND grade = p_grade
    AND period_type = 'daily'
    AND (p_variant_id IS NULL OR variant_id = p_variant_id)
    AND (p_grading_company_id IS NULL OR grading_company_id = p_grading_company_id)
  GROUP BY card_id, variant_id, grading_company_id, grade, date_trunc('week', period_start)
  ON CONFLICT (card_id, variant_id, grading_company_id, grade, period_start, period_type)
  DO UPDATE SET
    open_price = EXCLUDED.open_price,
    high_price = EXCLUDED.high_price,
    low_price = EXCLUDED.low_price,
    close_price = EXCLUDED.close_price,
    volume = EXCLUDED.volume;

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Latest OHLC for each card/grade combo
-- ============================================

CREATE OR REPLACE VIEW latest_ohlc AS
SELECT DISTINCT ON (card_id, grade, period_type)
  id,
  card_id,
  grade,
  period_type,
  period_start,
  open_price,
  high_price,
  low_price,
  close_price,
  volume,
  created_at
FROM price_history_ohlc
ORDER BY card_id, grade, period_type, period_start DESC;

-- ============================================
-- SEED POPULAR POKEMON CARDS WITH TCG IDS
-- ============================================

-- This updates existing cards with their Pokemon TCG API IDs
-- Run after cards have been imported

-- Base Set (base1)
-- UPDATE cards SET poke_tcg_id = 'base1-4' WHERE slug = 'charizard-holo' AND set_id = (SELECT id FROM sets WHERE slug = 'base-set');
-- UPDATE cards SET poke_tcg_id = 'base1-2' WHERE slug = 'blastoise-holo' AND set_id = (SELECT id FROM sets WHERE slug = 'base-set');
-- UPDATE cards SET poke_tcg_id = 'base1-15' WHERE slug = 'venusaur-holo' AND set_id = (SELECT id FROM sets WHERE slug = 'base-set');
-- UPDATE cards SET poke_tcg_id = 'base1-58' WHERE slug = 'pikachu' AND set_id = (SELECT id FROM sets WHERE slug = 'base-set');
-- UPDATE cards SET poke_tcg_id = 'base1-10' WHERE slug = 'mewtwo-holo' AND set_id = (SELECT id FROM sets WHERE slug = 'base-set');

-- Comment: Uncomment and run the above after seeding cards table
