-- TCGMaster Database Schema
-- Initial migration for complete platform setup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================
-- GAMES & CATEGORIES
-- ============================================

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  icon VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Pokemon as the only MVP game
INSERT INTO games (name, slug, display_name, icon, is_active) VALUES
  ('pokemon', 'pokemon', 'Pokémon', '/icons/pokemon.svg', true);

-- ============================================
-- SETS
-- ============================================

CREATE TABLE sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  release_date DATE,
  card_count INTEGER,
  image_url VARCHAR(512),
  ppt_set_id VARCHAR(50), -- PokemonPriceTracker set ID for API calls
  tcg_player_group_id VARCHAR(50), -- TCGPlayer group ID
  priority INTEGER DEFAULT 0, -- For import ordering (higher = import first)
  is_imported BOOLEAN DEFAULT false,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, slug)
);

CREATE INDEX idx_sets_game_id ON sets(game_id);
CREATE INDEX idx_sets_slug ON sets(slug);
CREATE INDEX idx_sets_priority ON sets(priority DESC);

-- ============================================
-- CARDS
-- ============================================

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  number VARCHAR(50) NOT NULL, -- Card number in set (e.g., "4/102")
  rarity VARCHAR(100),
  artist VARCHAR(255),
  description TEXT,
  -- External IDs
  tcg_player_id VARCHAR(50), -- Primary external key for API calls
  ppt_card_id VARCHAR(50), -- PokemonPriceTracker card ID
  -- Image handling
  image_url VARCHAR(512), -- CDN URL from source
  local_image_url VARCHAR(512), -- Self-hosted Supabase Storage URL
  image_fetched_at TIMESTAMPTZ,
  -- Price cache metadata
  last_price_fetch TIMESTAMPTZ,
  price_cache_ttl INTEGER DEFAULT 3600, -- TTL in seconds (1-4 hours)
  -- SEO content
  lore TEXT,
  print_run_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(set_id, slug)
);

CREATE INDEX idx_cards_set_id ON cards(set_id);
CREATE INDEX idx_cards_slug ON cards(slug);
CREATE INDEX idx_cards_tcg_player_id ON cards(tcg_player_id);
CREATE INDEX idx_cards_name_trgm ON cards USING gin(name gin_trgm_ops);

-- ============================================
-- CARD VARIANTS
-- ============================================

CREATE TYPE variant_type AS ENUM (
  '1st-edition',
  'shadowless',
  'unlimited',
  'reverse-holo',
  'holo',
  'non-holo',
  'promo',
  'error'
);

CREATE TABLE card_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_type variant_type NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  tcg_player_variant_id VARCHAR(50),
  price_multiplier DECIMAL(5,2) DEFAULT 1.0, -- Relative to base card
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, variant_type)
);

CREATE INDEX idx_card_variants_card_id ON card_variants(card_id);

-- ============================================
-- GRADING COMPANIES
-- ============================================

CREATE TABLE grading_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  grade_scale VARCHAR(50) NOT NULL, -- "1-10", "1-10 with half"
  min_grade DECIMAL(3,1) DEFAULT 1,
  max_grade DECIMAL(3,1) DEFAULT 10,
  has_subgrades BOOLEAN DEFAULT false,
  cert_lookup_url VARCHAR(512),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed grading companies
INSERT INTO grading_companies (name, slug, grade_scale, has_subgrades, cert_lookup_url) VALUES
  ('Professional Sports Authenticator', 'psa', '1-10', false, 'https://www.psacard.com/cert/'),
  ('Beckett Grading Services', 'bgs', '1-10 with half', true, 'https://www.beckett.com/grading/card-lookup/'),
  ('Certified Guaranty Company', 'cgc', '1-10 with half', false, 'https://www.cgccards.com/certlookup/'),
  ('Sportscard Guaranty', 'sgc', '1-10', false, 'https://gosgc.com/card-lookup/');

-- ============================================
-- GRADED CARDS
-- ============================================

CREATE TABLE graded_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  grading_company_id UUID NOT NULL REFERENCES grading_companies(id),
  grade DECIMAL(3,1) NOT NULL,
  cert_number VARCHAR(50) UNIQUE,
  -- Auto/signature data
  is_auto BOOLEAN DEFAULT false,
  auto_grade DECIMAL(3,1),
  signer_name VARCHAR(255),
  signer_tier CHAR(1), -- S, A, B, C
  authenticated_by VARCHAR(100), -- PSA, BGS, JSA, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_graded_cards_card_id ON graded_cards(card_id);
CREATE INDEX idx_graded_cards_cert_number ON graded_cards(cert_number);
CREATE INDEX idx_graded_cards_grade ON graded_cards(grading_company_id, grade);

-- ============================================
-- PRICE CACHE (API responses with TTL)
-- ============================================

CREATE TABLE price_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE CASCADE,
  -- Raw condition prices
  raw_prices JSONB DEFAULT '{}'::jsonb,
  -- Graded prices by company and grade
  graded_prices JSONB DEFAULT '{}'::jsonb,
  -- eBay sales data
  ebay_sales JSONB DEFAULT '{}'::jsonb,
  -- Cache metadata
  source VARCHAR(50) DEFAULT 'ppt',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(card_id, variant_id)
);

CREATE INDEX idx_price_cache_expires ON price_cache(expires_at);
CREATE INDEX idx_price_cache_card_id ON price_cache(card_id);

-- ============================================
-- PRICE HISTORY (permanent storage for charts)
-- ============================================

CREATE TYPE price_source AS ENUM (
  'ebay',
  'tcgplayer',
  'pwcc',
  'goldin',
  'heritage',
  'user-submitted',
  'ppt-api'
);

CREATE TYPE price_confidence AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  grading_company_id UUID REFERENCES grading_companies(id),
  grade VARCHAR(10) DEFAULT 'raw',
  price DECIMAL(12,2) NOT NULL,
  source price_source NOT NULL,
  confidence price_confidence DEFAULT 'medium',
  sale_type VARCHAR(50), -- 'auction', 'buy-it-now', 'best-offer'
  is_notable BOOLEAN DEFAULT false, -- Celebrity sales, etc.
  notable_reason TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_history_card_id ON price_history(card_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at DESC);
CREATE INDEX idx_price_history_grade ON price_history(grading_company_id, grade);

-- Partition by month for performance (optional, can add later)

-- ============================================
-- POPULATION REPORTS (from GemRate scraping)
-- ============================================

CREATE TABLE population_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  grading_company_id UUID NOT NULL REFERENCES grading_companies(id),
  grade DECIMAL(3,1) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  gem_rate DECIMAL(5,2), -- Percentage that achieved this grade or higher
  total_population INTEGER, -- Total graded for this card at this company
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  source_url VARCHAR(512),
  UNIQUE(card_id, grading_company_id, grade)
);

CREATE INDEX idx_population_reports_card_id ON population_reports(card_id);

-- ============================================
-- CERT HISTORY (scraped from PSA/BGS verify pages)
-- ============================================

CREATE TABLE cert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cert_number VARCHAR(50) NOT NULL,
  grading_company_id UUID NOT NULL REFERENCES grading_companies(id),
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL, -- May be null if card not in DB
  -- Cert details
  grade DECIMAL(3,1) NOT NULL,
  subgrades JSONB, -- {centering: 9.5, corners: 9, edges: 9.5, surface: 9}
  cert_date DATE,
  -- Holder info
  holder_generation VARCHAR(50), -- "PSA Gen 4", "BGS black label era"
  holder_type VARCHAR(50), -- "standard", "tuxedo", "black-label"
  -- History tracking
  is_reholder BOOLEAN DEFAULT false,
  previous_cert_number VARCHAR(50),
  crossover_from UUID REFERENCES grading_companies(id), -- Previous grading company
  grade_history JSONB DEFAULT '[]'::jsonb, -- [{date, grade, event}]
  -- Verification
  is_verified BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  -- Flags
  is_suspicious BOOLEAN DEFAULT false,
  suspicion_reason TEXT,
  -- Metadata
  raw_data JSONB, -- Full scraped data
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cert_number, grading_company_id)
);

CREATE INDEX idx_cert_history_cert_number ON cert_history(cert_number);
CREATE INDEX idx_cert_history_card_id ON cert_history(card_id);

-- ============================================
-- USERS
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY, -- References Supabase Auth user
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  avatar_url VARCHAR(512),
  settings JSONB DEFAULT '{}'::jsonb,
  -- Premium features
  is_premium BOOLEAN DEFAULT false,
  premium_until TIMESTAMPTZ,
  -- Stats
  total_collection_value DECIMAL(14,2) DEFAULT 0,
  cards_count INTEGER DEFAULT 0,
  -- Flags
  is_founding_collector BOOLEAN DEFAULT false, -- For retroactive badges
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COLLECTIONS
-- ============================================

CREATE TYPE collection_type AS ENUM (
  'personal',
  'investment',
  'for-sale',
  'wishlist',
  'custom'
);

CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type collection_type NOT NULL DEFAULT 'personal',
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  anonymous_share BOOLEAN DEFAULT false,
  share_token VARCHAR(50) UNIQUE, -- For shareable links
  -- Stats (denormalized for performance)
  total_value DECIMAL(14,2) DEFAULT 0,
  total_cost_basis DECIMAL(14,2) DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_collections_share_token ON collections(share_token);

-- ============================================
-- COLLECTION ITEMS (separate line items per graded copy)
-- ============================================

CREATE TYPE acquisition_type AS ENUM (
  'purchase',
  'trade',
  'gift',
  'pull',
  'grading-return',
  'other'
);

CREATE TABLE collection_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  -- Grading info
  grade VARCHAR(10) DEFAULT 'raw',
  grading_company_id UUID REFERENCES grading_companies(id),
  cert_number VARCHAR(50),
  -- Cost tracking
  cost_basis DECIMAL(12,2),
  cost_basis_source VARCHAR(50) DEFAULT 'user_entered', -- 'user_entered', 'historical_auto'
  fees DECIMAL(12,2) DEFAULT 0, -- Grading, shipping, platform fees
  -- Acquisition
  acquisition_date DATE,
  acquisition_type acquisition_type DEFAULT 'purchase',
  acquisition_source VARCHAR(255), -- eBay, LCS, trade, etc.
  -- Notes
  notes TEXT,
  -- Current value (updated periodically)
  current_value DECIMAL(12,2),
  value_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX idx_collection_items_card_id ON collection_items(card_id);
CREATE INDEX idx_collection_items_cert_number ON collection_items(cert_number);

-- ============================================
-- PRICE ALERTS
-- ============================================

CREATE TYPE alert_direction AS ENUM (
  'up',
  'down',
  'both'
);

CREATE TYPE delivery_method AS ENUM (
  'email',
  'push',
  'both'
);

CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  grade VARCHAR(10) DEFAULT 'raw',
  grading_company_id UUID REFERENCES grading_companies(id),
  -- Alert config
  threshold_percent DECIMAL(5,2) NOT NULL,
  direction alert_direction DEFAULT 'both',
  baseline_price DECIMAL(12,2), -- Price when alert was set
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  -- Delivery
  delivery_method delivery_method DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX idx_price_alerts_card_id ON price_alerts(card_id);
CREATE INDEX idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;

-- ============================================
-- USER ACHIEVEMENTS
-- ============================================

CREATE TYPE achievement_type AS ENUM (
  'first_card',
  'set_complete_base',
  'set_complete_plus',
  'first_psa_10',
  'portfolio_1k',
  'portfolio_10k',
  'portfolio_100k',
  'cards_100',
  'cards_500',
  'cards_1000',
  'grade_upgrader',
  'diversified',
  'founding_collector',
  'early_adopter',
  'price_predictor',
  'community_helper'
);

CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type achievement_type NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  is_founding_collector BOOLEAN DEFAULT false, -- Special styling for early adopters
  metadata JSONB DEFAULT '{}'::jsonb, -- Extra context (which set completed, etc.)
  UNIQUE(user_id, achievement_type)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);

-- ============================================
-- PRICE SUGGESTIONS (community pricing)
-- ============================================

CREATE TABLE price_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  grade VARCHAR(10) DEFAULT 'raw',
  suggested_price DECIMAL(12,2) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reasoning TEXT,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  is_graduated BOOLEAN DEFAULT false, -- True when confirmed by real sales
  graduated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_suggestions_card_id ON price_suggestions(card_id);

-- ============================================
-- TRENDING SCORES (for homepage)
-- ============================================

CREATE TABLE trending_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE UNIQUE,
  -- Individual components
  price_change_24h DECIMAL(8,4) DEFAULT 0, -- Percentage
  volume_24h INTEGER DEFAULT 0, -- Number of sales
  search_count_24h INTEGER DEFAULT 0,
  social_mentions_24h INTEGER DEFAULT 0,
  -- Combined score (weighted)
  combined_score DECIMAL(12,4) DEFAULT 0,
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trending_scores_combined ON trending_scores(combined_score DESC);
CREATE INDEX idx_trending_scores_card_id ON trending_scores(card_id);

-- ============================================
-- SEARCH ANALYTICS (for trending algorithm)
-- ============================================

CREATE TABLE search_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  search_query VARCHAR(512) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(100),
  result_clicked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_analytics_card_id ON search_analytics(card_id);
CREATE INDEX idx_search_analytics_created_at ON search_analytics(created_at DESC);

-- ============================================
-- SET COMPLETION TRACKING
-- ============================================

CREATE TABLE set_completion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  -- Base completion (numbered cards only)
  base_cards_owned INTEGER DEFAULT 0,
  base_cards_total INTEGER NOT NULL,
  base_completion_percent DECIMAL(5,2) DEFAULT 0,
  -- Complete+ (including secrets, promos, variants)
  plus_cards_owned INTEGER DEFAULT 0,
  plus_cards_total INTEGER NOT NULL,
  plus_completion_percent DECIMAL(5,2) DEFAULT 0,
  -- Timestamps
  base_completed_at TIMESTAMPTZ,
  plus_completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, set_id)
);

CREATE INDEX idx_set_completion_user_id ON set_completion(user_id);

-- ============================================
-- NOTIFICATION QUEUE (for batch processing)
-- ============================================

CREATE TYPE notification_type AS ENUM (
  'price_alert',
  'achievement',
  'collection_shared',
  'system'
);

CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  is_sent_email BOOLEAN DEFAULT false,
  is_sent_push BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_user_id ON notification_queue(user_id);
CREATE INDEX idx_notification_queue_unsent ON notification_queue(is_sent_email) WHERE is_sent_email = false;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on user-specific tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Collections policies
CREATE POLICY "Users can view own collections" ON collections
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can manage own collections" ON collections
  FOR ALL USING (auth.uid() = user_id);

-- Collection items policies
CREATE POLICY "Users can view own collection items" ON collection_items
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM collections WHERE id = collection_id)
    OR (SELECT is_public FROM collections WHERE id = collection_id) = true
  );

CREATE POLICY "Users can manage own collection items" ON collection_items
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM collections WHERE id = collection_id)
  );

-- Price alerts policies
CREATE POLICY "Users can manage own alerts" ON price_alerts
  FOR ALL USING (auth.uid() = user_id);

-- Achievements policies
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notification_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notification_queue
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update collection stats
CREATE OR REPLACE FUNCTION update_collection_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE collections
  SET
    items_count = (SELECT COUNT(*) FROM collection_items WHERE collection_id = COALESCE(NEW.collection_id, OLD.collection_id)),
    total_cost_basis = (SELECT COALESCE(SUM(cost_basis), 0) FROM collection_items WHERE collection_id = COALESCE(NEW.collection_id, OLD.collection_id)),
    total_value = (SELECT COALESCE(SUM(current_value), 0) FROM collection_items WHERE collection_id = COALESCE(NEW.collection_id, OLD.collection_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.collection_id, OLD.collection_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for collection stats
CREATE TRIGGER trigger_update_collection_stats
AFTER INSERT OR UPDATE OR DELETE ON collection_items
FOR EACH ROW EXECUTE FUNCTION update_collection_stats();

-- Function to update user stats
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET
    cards_count = (SELECT COALESCE(SUM(items_count), 0) FROM collections WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)),
    total_collection_value = (SELECT COALESCE(SUM(total_value), 0) FROM collections WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for user stats
CREATE TRIGGER trigger_update_user_stats
AFTER INSERT OR UPDATE OR DELETE ON collections
FOR EACH ROW EXECUTE FUNCTION update_user_stats();

-- Function to calculate trending score
CREATE OR REPLACE FUNCTION calculate_trending_score(
  p_price_change DECIMAL,
  p_volume INTEGER,
  p_searches INTEGER,
  p_social INTEGER
) RETURNS DECIMAL AS $$
BEGIN
  RETURN (p_price_change * 0.3) +
         (p_volume * 0.25) +
         (p_searches * 0.25) +
         (p_social * 0.2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STORAGE BUCKET FOR CARD IMAGES
-- ============================================

-- Note: Run this in Supabase Dashboard SQL Editor
-- INSERT INTO storage.buckets (id, name, public) VALUES ('card-images', 'card-images', true);
