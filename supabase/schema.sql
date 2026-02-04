-- TCGMaster Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============== Games ==============
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============== Sets ==============
CREATE TABLE sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  release_date DATE,
  card_count INTEGER,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, slug)
);

CREATE INDEX idx_sets_game_id ON sets(game_id);
CREATE INDEX idx_sets_slug ON sets(slug);

-- ============== Cards ==============
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  number TEXT NOT NULL,
  rarity TEXT,
  artist TEXT,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(set_id, slug)
);

CREATE INDEX idx_cards_set_id ON cards(set_id);
CREATE INDEX idx_cards_name ON cards(name);
CREATE INDEX idx_cards_slug ON cards(slug);

-- Full text search index
CREATE INDEX idx_cards_name_search ON cards USING gin(to_tsvector('english', name));

-- ============== Card Variants ==============
CREATE TABLE card_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, slug)
);

CREATE INDEX idx_card_variants_card_id ON card_variants(card_id);

-- ============== Grading Companies ==============
CREATE TABLE grading_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  grade_scale TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============== Graded Cards ==============
CREATE TABLE graded_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  grading_company_id UUID NOT NULL REFERENCES grading_companies(id),
  grade TEXT NOT NULL,
  cert_number TEXT,
  auto_grade TEXT,
  signer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cert_number, grading_company_id)
);

CREATE INDEX idx_graded_cards_card_id ON graded_cards(card_id);
CREATE INDEX idx_graded_cards_cert_number ON graded_cards(cert_number);

-- ============== Price History ==============
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  grading_company_id UUID REFERENCES grading_companies(id),
  grade TEXT NOT NULL DEFAULT 'raw',
  price DECIMAL(12, 2) NOT NULL,
  source TEXT NOT NULL,
  confidence TEXT DEFAULT 'medium',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_history_card_id ON price_history(card_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at DESC);
CREATE INDEX idx_price_history_card_grade ON price_history(card_id, grade, grading_company_id);

-- ============== Population Reports ==============
CREATE TABLE population_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  grading_company_id UUID NOT NULL REFERENCES grading_companies(id),
  grade TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, grading_company_id, grade)
);

CREATE INDEX idx_population_reports_card_id ON population_reports(card_id);

-- ============== Users ==============
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{"currency": "USD", "email_notifications": true, "price_alert_threshold": 10, "dark_mode": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============== Collections ==============
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'personal',
  is_public BOOLEAN DEFAULT FALSE,
  anonymous_share BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collections_user_id ON collections(user_id);

-- ============== Collection Items ==============
CREATE TABLE collection_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  grade TEXT DEFAULT 'raw',
  grading_company_id UUID REFERENCES grading_companies(id),
  cert_number TEXT,
  cost_basis DECIMAL(12, 2),
  acquisition_date DATE,
  acquisition_type TEXT DEFAULT 'purchase',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX idx_collection_items_card_id ON collection_items(card_id);

-- ============== Price Alerts ==============
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  grade TEXT DEFAULT 'raw',
  grading_company_id UUID REFERENCES grading_companies(id),
  threshold_percent DECIMAL(5, 2) NOT NULL,
  direction TEXT DEFAULT 'both',
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX idx_price_alerts_card_id ON price_alerts(card_id);

-- ============== User Achievements ==============
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(user_id, achievement_type)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);

-- ============== Price Suggestions ==============
CREATE TABLE price_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES card_variants(id) ON DELETE SET NULL,
  grade TEXT DEFAULT 'raw',
  suggested_price DECIMAL(12, 2) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_suggestions_card_id ON price_suggestions(card_id);

-- ============== Row Level Security ==============
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_suggestions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON users FOR UPDATE USING (auth.uid() = id);

-- Collections policies
CREATE POLICY "Users can view their own collections" ON collections FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);
CREATE POLICY "Users can create collections" ON collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own collections" ON collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own collections" ON collections FOR DELETE USING (auth.uid() = user_id);

-- Collection items policies
CREATE POLICY "Users can view items in accessible collections" ON collection_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM collections WHERE collections.id = collection_items.collection_id AND (collections.user_id = auth.uid() OR collections.is_public = TRUE)));
CREATE POLICY "Users can manage items in their collections" ON collection_items FOR ALL
  USING (EXISTS (SELECT 1 FROM collections WHERE collections.id = collection_items.collection_id AND collections.user_id = auth.uid()));

-- Price alerts policies
CREATE POLICY "Users can manage their own alerts" ON price_alerts FOR ALL USING (auth.uid() = user_id);

-- User achievements policies
CREATE POLICY "Users can view their own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);

-- Price suggestions policies
CREATE POLICY "Anyone can view price suggestions" ON price_suggestions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Users can create price suggestions" ON price_suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============== Seed Data ==============
-- Grading Companies
INSERT INTO grading_companies (name, slug, grade_scale) VALUES
  ('Professional Sports Authenticator', 'psa', '1-10'),
  ('Beckett Grading Services', 'bgs', '1-10'),
  ('Certified Guaranty Company', 'cgc', '1-10'),
  ('Sportscard Guaranty Corporation', 'sgc', '1-10');

-- Games
INSERT INTO games (name, slug, display_name, icon) VALUES
  ('Pokemon', 'pokemon', 'Pokemon', '/icons/pokemon.svg'),
  ('Basketball', 'sports-basketball', 'Basketball Cards', '/icons/basketball.svg'),
  ('Baseball', 'sports-baseball', 'Baseball Cards', '/icons/baseball.svg');

-- Sample Pokemon Sets
INSERT INTO sets (game_id, name, slug, release_date, card_count) VALUES
  ((SELECT id FROM games WHERE slug = 'pokemon'), 'Base Set', 'base-set', '1999-01-09', 102),
  ((SELECT id FROM games WHERE slug = 'pokemon'), 'Jungle', 'jungle', '1999-06-16', 64),
  ((SELECT id FROM games WHERE slug = 'pokemon'), 'Fossil', 'fossil', '1999-10-10', 62),
  ((SELECT id FROM games WHERE slug = 'pokemon'), 'Base Set 2', 'base-set-2', '2000-02-24', 130),
  ((SELECT id FROM games WHERE slug = 'pokemon'), 'Team Rocket', 'team-rocket', '2000-04-24', 83);

-- Sample Cards (Base Set)
INSERT INTO cards (set_id, name, slug, number, rarity, artist) VALUES
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Alakazam', 'alakazam-holo', '1', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Blastoise', 'blastoise-holo', '2', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Chansey', 'chansey-holo', '3', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Charizard', 'charizard-holo', '4', 'holo-rare', 'Mitsuhiro Arita'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Clefairy', 'clefairy-holo', '5', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Gyarados', 'gyarados-holo', '6', 'holo-rare', 'Mitsuhiro Arita'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Hitmonchan', 'hitmonchan-holo', '7', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Machamp', 'machamp-holo', '8', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Magneton', 'magneton-holo', '9', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Mewtwo', 'mewtwo-holo', '10', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Nidoking', 'nidoking-holo', '11', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Ninetales', 'ninetales-holo', '12', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Poliwrath', 'poliwrath-holo', '13', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Raichu', 'raichu-holo', '14', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Venusaur', 'venusaur-holo', '15', 'holo-rare', 'Mitsuhiro Arita'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Zapdos', 'zapdos-holo', '16', 'holo-rare', 'Ken Sugimori'),
  ((SELECT id FROM sets WHERE slug = 'base-set'), 'Pikachu', 'pikachu', '58', 'common', 'Mitsuhiro Arita');

-- Card Variants for Charizard
INSERT INTO card_variants (card_id, variant_type, name, slug) VALUES
  ((SELECT id FROM cards WHERE slug = 'charizard-holo' AND set_id = (SELECT id FROM sets WHERE slug = 'base-set')), '1st-edition', '1st Edition', '1st-edition'),
  ((SELECT id FROM cards WHERE slug = 'charizard-holo' AND set_id = (SELECT id FROM sets WHERE slug = 'base-set')), 'shadowless', 'Shadowless', 'shadowless'),
  ((SELECT id FROM cards WHERE slug = 'charizard-holo' AND set_id = (SELECT id FROM sets WHERE slug = 'base-set')), 'unlimited', 'Unlimited', 'unlimited');
