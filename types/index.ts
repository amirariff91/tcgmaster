// Core Database Types for TCGMaster

// ============== Games & Categories ==============
export type GameSlug = 'pokemon' | 'sports-basketball' | 'sports-baseball' | 'sports-football' | 'sports-hockey';

export interface Game {
  id: string;
  name: string;
  slug: GameSlug;
  display_name: string;
  icon: string | null;
  created_at: string;
}

// ============== Sets ==============
export interface Set {
  id: string;
  game_id: string;
  name: string;
  slug: string;
  release_date: string | null;
  card_count: number | null;
  image_url: string | null;
  created_at: string;
  // Relations
  game?: Game;
}

// ============== Cards ==============
export type Rarity = 'common' | 'uncommon' | 'rare' | 'holo-rare' | 'ultra-rare' | 'secret-rare' | 'promo';

export interface Card {
  id: string;
  set_id: string;
  name: string;
  slug: string;
  number: string;
  rarity: Rarity | null;
  artist: string | null;
  image_url: string | null;
  description: string | null;
  created_at: string;
  // Relations
  set?: Set;
  variants?: CardVariant[];
  price_history?: PriceHistory[];
}

// ============== Card Variants ==============
export type VariantType = '1st-edition' | 'shadowless' | 'unlimited' | 'reverse-holo' | 'numbered' | 'refractor' | 'auto';

export interface CardVariant {
  id: string;
  card_id: string;
  variant_type: VariantType;
  name: string;
  slug: string;
  created_at: string;
  // Relations
  card?: Card;
}

// ============== Grading ==============
export type GradingCompanySlug = 'psa' | 'bgs' | 'cgc' | 'sgc';

export interface GradingCompany {
  id: string;
  name: string;
  slug: GradingCompanySlug;
  grade_scale: string; // e.g., "1-10"
  created_at: string;
}

export type Grade = '1' | '1.5' | '2' | '2.5' | '3' | '3.5' | '4' | '4.5' | '5' | '5.5' | '6' | '6.5' | '7' | '7.5' | '8' | '8.5' | '9' | '9.5' | '10';

export interface GradedCard {
  id: string;
  card_id: string;
  variant_id: string | null;
  grading_company_id: string;
  grade: Grade;
  cert_number: string | null;
  auto_grade: Grade | null;
  signer_name: string | null;
  created_at: string;
  // Relations
  card?: Card;
  variant?: CardVariant;
  grading_company?: GradingCompany;
}

// ============== Pricing ==============
export type PriceConfidence = 'high' | 'medium' | 'low';
export type PriceSource = 'ebay' | 'tcgplayer' | 'pwcc' | 'goldin' | 'heritage' | 'user-submitted';

export interface PriceHistory {
  id: string;
  card_id: string;
  variant_id: string | null;
  grading_company_id: string | null;
  grade: Grade | 'raw';
  price: number;
  source: PriceSource;
  confidence: PriceConfidence;
  recorded_at: string;
  // Relations
  card?: Card;
  variant?: CardVariant;
  grading_company?: GradingCompany;
}

export interface CurrentPrice {
  card_id: string;
  variant_id: string | null;
  grading_company_id: string | null;
  grade: Grade | 'raw';
  price: number;
  confidence: PriceConfidence;
  last_sale_date: string;
  price_change_24h: number | null;
  price_change_7d: number | null;
  price_change_30d: number | null;
}

// ============== Population Reports ==============
export interface PopulationReport {
  id: string;
  card_id: string;
  grading_company_id: string;
  grade: Grade;
  count: number;
  updated_at: string;
  // Relations
  card?: Card;
  grading_company?: GradingCompany;
}

// ============== Users ==============
export interface UserSettings {
  currency: string;
  email_notifications: boolean;
  price_alert_threshold: number;
  dark_mode: boolean;
}

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  settings: UserSettings;
  created_at: string;
}

// ============== Collections ==============
export type CollectionType = 'personal' | 'investment' | 'for-sale' | 'wishlist' | 'custom';

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  type: CollectionType;
  is_public: boolean;
  anonymous_share: boolean;
  created_at: string;
  // Relations
  user?: User;
  items?: CollectionItem[];
}

export type AcquisitionType = 'purchase' | 'trade' | 'gift' | 'pack-pull' | 'other';

export interface CollectionItem {
  id: string;
  collection_id: string;
  card_id: string;
  variant_id: string | null;
  grade: Grade | 'raw';
  grading_company_id: string | null;
  cert_number: string | null;
  cost_basis: number | null;
  acquisition_date: string | null;
  acquisition_type: AcquisitionType;
  notes: string | null;
  created_at: string;
  // Relations
  collection?: Collection;
  card?: Card;
  variant?: CardVariant;
  grading_company?: GradingCompany;
  // Computed
  current_price?: number;
  gain_loss?: number;
  gain_loss_percent?: number;
}

// ============== Price Alerts ==============
export type AlertDirection = 'up' | 'down' | 'both';

export interface PriceAlert {
  id: string;
  user_id: string;
  card_id: string;
  variant_id: string | null;
  grade: Grade | 'raw';
  grading_company_id: string | null;
  threshold_percent: number;
  direction: AlertDirection;
  is_active: boolean;
  last_triggered: string | null;
  created_at: string;
  // Relations
  user?: User;
  card?: Card;
  variant?: CardVariant;
  grading_company?: GradingCompany;
}

// ============== Achievements ==============
export type AchievementType =
  | 'first-card'
  | 'complete-set'
  | 'first-psa-10'
  | 'portfolio-1k'
  | 'portfolio-10k'
  | 'portfolio-100k'
  | 'cards-100'
  | 'grade-upgrader'
  | 'diversified';

export interface Achievement {
  id: string;
  type: AchievementType;
  name: string;
  description: string;
  icon: string;
  points: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_type: AchievementType;
  earned_at: string;
  metadata: Record<string, unknown> | null;
  // Relations
  user?: User;
  achievement?: Achievement;
}

// ============== Community Price Suggestions ==============
export interface PriceSuggestion {
  id: string;
  card_id: string;
  variant_id: string | null;
  grade: Grade | 'raw';
  suggested_price: number;
  user_id: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  // Relations
  card?: Card;
  variant?: CardVariant;
  user?: User;
}

// ============== Search ==============
export interface SearchResult {
  type: 'card' | 'set' | 'game';
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  subtitle: string | null; // e.g., "Base Set - #4/102"
  price: number | null;
  game: GameSlug;
}

export interface SearchFilters {
  game?: GameSlug;
  set?: string;
  grading_company?: GradingCompanySlug;
  grade?: Grade | 'raw';
  min_price?: number;
  max_price?: number;
  rarity?: Rarity;
}

// ============== API Response Types ==============
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ============== Portfolio Analytics ==============
export interface PortfolioSummary {
  total_value: number;
  total_cost_basis: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  card_count: number;
  best_performer: CollectionItem | null;
  worst_performer: CollectionItem | null;
  by_game: Record<GameSlug, { value: number; count: number }>;
  by_grade: Record<Grade | 'raw', { value: number; count: number }>;
}

// ============== Price Ladder ==============
export interface PriceLadderEntry {
  grade: Grade | 'raw';
  grading_company: GradingCompanySlug | null;
  price: number;
  confidence: PriceConfidence;
  last_sale_date: string | null;
  population: number | null;
}

// ============== Market Data ==============
export interface MarketMover {
  card: Card;
  current_price: number;
  previous_price: number;
  change_percent: number;
  grade: Grade | 'raw';
  grading_company: GradingCompanySlug | null;
}

export interface TrendingCard {
  card: Card;
  search_count: number;
  price: number | null;
}

export interface NotableSale {
  card: Card;
  price: number;
  grade: Grade;
  grading_company: GradingCompanySlug;
  sale_date: string;
  source: PriceSource;
  notes: string | null;
}

// ============== Cert Lookup ==============
export interface CertLookupResult {
  cert_number: string;
  grading_company: GradingCompanySlug;
  card: Card | null;
  grade: Grade;
  subgrades?: {
    centering?: number;
    corners?: number;
    edges?: number;
    surface?: number;
  };
  cert_date: string | null;
  cert_image_url: string | null;
  is_valid: boolean;
  fraud_flags: string[];
}
