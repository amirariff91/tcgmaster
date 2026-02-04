export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VariantType =
  | '1st-edition'
  | 'shadowless'
  | 'unlimited'
  | 'reverse-holo'
  | 'holo'
  | 'non-holo'
  | 'promo'
  | 'error';

export type PriceSource =
  | 'ebay'
  | 'tcgplayer'
  | 'pwcc'
  | 'goldin'
  | 'heritage'
  | 'user-submitted'
  | 'ppt-api';

export type PriceConfidence = 'high' | 'medium' | 'low';

export type CollectionType = 'personal' | 'investment' | 'for-sale' | 'wishlist' | 'custom';

export type AcquisitionType = 'purchase' | 'trade' | 'gift' | 'pull' | 'grading-return' | 'other';

export type AlertDirection = 'up' | 'down' | 'both';

export type DeliveryMethod = 'email' | 'push' | 'both';

export type AchievementType =
  | 'first_card'
  | 'set_complete_base'
  | 'set_complete_plus'
  | 'first_psa_10'
  | 'portfolio_1k'
  | 'portfolio_10k'
  | 'portfolio_100k'
  | 'cards_100'
  | 'cards_500'
  | 'cards_1000'
  | 'grade_upgrader'
  | 'diversified'
  | 'founding_collector'
  | 'early_adopter'
  | 'price_predictor'
  | 'community_helper';

export type NotificationType = 'price_alert' | 'achievement' | 'collection_shared' | 'system';

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          name: string;
          slug: string;
          display_name: string;
          icon: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          display_name: string;
          icon?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          display_name?: string;
          icon?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      sets: {
        Row: {
          id: string;
          game_id: string;
          name: string;
          slug: string;
          release_date: string | null;
          card_count: number | null;
          image_url: string | null;
          ppt_set_id: string | null;
          tcg_player_group_id: string | null;
          priority: number;
          is_imported: boolean;
          imported_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          name: string;
          slug: string;
          release_date?: string | null;
          card_count?: number | null;
          image_url?: string | null;
          ppt_set_id?: string | null;
          tcg_player_group_id?: string | null;
          priority?: number;
          is_imported?: boolean;
          imported_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          name?: string;
          slug?: string;
          release_date?: string | null;
          card_count?: number | null;
          image_url?: string | null;
          ppt_set_id?: string | null;
          tcg_player_group_id?: string | null;
          priority?: number;
          is_imported?: boolean;
          imported_at?: string | null;
          created_at?: string;
        };
      };
      cards: {
        Row: {
          id: string;
          set_id: string;
          name: string;
          slug: string;
          number: string;
          rarity: string | null;
          artist: string | null;
          description: string | null;
          tcg_player_id: string | null;
          ppt_card_id: string | null;
          image_url: string | null;
          local_image_url: string | null;
          image_fetched_at: string | null;
          last_price_fetch: string | null;
          price_cache_ttl: number;
          lore: string | null;
          print_run_info: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          set_id: string;
          name: string;
          slug: string;
          number: string;
          rarity?: string | null;
          artist?: string | null;
          description?: string | null;
          tcg_player_id?: string | null;
          ppt_card_id?: string | null;
          image_url?: string | null;
          local_image_url?: string | null;
          image_fetched_at?: string | null;
          last_price_fetch?: string | null;
          price_cache_ttl?: number;
          lore?: string | null;
          print_run_info?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          set_id?: string;
          name?: string;
          slug?: string;
          number?: string;
          rarity?: string | null;
          artist?: string | null;
          description?: string | null;
          tcg_player_id?: string | null;
          ppt_card_id?: string | null;
          image_url?: string | null;
          local_image_url?: string | null;
          image_fetched_at?: string | null;
          last_price_fetch?: string | null;
          price_cache_ttl?: number;
          lore?: string | null;
          print_run_info?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      card_variants: {
        Row: {
          id: string;
          card_id: string;
          variant_type: VariantType;
          name: string;
          slug: string;
          tcg_player_variant_id: string | null;
          price_multiplier: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          variant_type: VariantType;
          name: string;
          slug: string;
          tcg_player_variant_id?: string | null;
          price_multiplier?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          variant_type?: VariantType;
          name?: string;
          slug?: string;
          tcg_player_variant_id?: string | null;
          price_multiplier?: number;
          created_at?: string;
        };
      };
      grading_companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          grade_scale: string;
          min_grade: number;
          max_grade: number;
          has_subgrades: boolean;
          cert_lookup_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          grade_scale: string;
          min_grade?: number;
          max_grade?: number;
          has_subgrades?: boolean;
          cert_lookup_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          grade_scale?: string;
          min_grade?: number;
          max_grade?: number;
          has_subgrades?: boolean;
          cert_lookup_url?: string | null;
          created_at?: string;
        };
      };
      graded_cards: {
        Row: {
          id: string;
          card_id: string;
          variant_id: string | null;
          grading_company_id: string;
          grade: number;
          cert_number: string | null;
          is_auto: boolean;
          auto_grade: number | null;
          signer_name: string | null;
          signer_tier: string | null;
          authenticated_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          variant_id?: string | null;
          grading_company_id: string;
          grade: number;
          cert_number?: string | null;
          is_auto?: boolean;
          auto_grade?: number | null;
          signer_name?: string | null;
          signer_tier?: string | null;
          authenticated_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          variant_id?: string | null;
          grading_company_id?: string;
          grade?: number;
          cert_number?: string | null;
          is_auto?: boolean;
          auto_grade?: number | null;
          signer_name?: string | null;
          signer_tier?: string | null;
          authenticated_by?: string | null;
          created_at?: string;
        };
      };
      price_cache: {
        Row: {
          id: string;
          card_id: string;
          variant_id: string | null;
          raw_prices: Json;
          graded_prices: Json;
          ebay_sales: Json;
          source: string;
          fetched_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          variant_id?: string | null;
          raw_prices?: Json;
          graded_prices?: Json;
          ebay_sales?: Json;
          source?: string;
          fetched_at?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          variant_id?: string | null;
          raw_prices?: Json;
          graded_prices?: Json;
          ebay_sales?: Json;
          source?: string;
          fetched_at?: string;
          expires_at?: string;
        };
      };
      price_history: {
        Row: {
          id: string;
          card_id: string;
          variant_id: string | null;
          grading_company_id: string | null;
          grade: string;
          price: number;
          source: PriceSource;
          confidence: PriceConfidence;
          sale_type: string | null;
          is_notable: boolean;
          notable_reason: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          variant_id?: string | null;
          grading_company_id?: string | null;
          grade?: string;
          price: number;
          source: PriceSource;
          confidence?: PriceConfidence;
          sale_type?: string | null;
          is_notable?: boolean;
          notable_reason?: string | null;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          variant_id?: string | null;
          grading_company_id?: string | null;
          grade?: string;
          price?: number;
          source?: PriceSource;
          confidence?: PriceConfidence;
          sale_type?: string | null;
          is_notable?: boolean;
          notable_reason?: string | null;
          recorded_at?: string;
        };
      };
      population_reports: {
        Row: {
          id: string;
          card_id: string;
          grading_company_id: string;
          grade: number;
          count: number;
          gem_rate: number | null;
          total_population: number | null;
          scraped_at: string;
          source_url: string | null;
        };
        Insert: {
          id?: string;
          card_id: string;
          grading_company_id: string;
          grade: number;
          count: number;
          gem_rate?: number | null;
          total_population?: number | null;
          scraped_at?: string;
          source_url?: string | null;
        };
        Update: {
          id?: string;
          card_id?: string;
          grading_company_id?: string;
          grade?: number;
          count?: number;
          gem_rate?: number | null;
          total_population?: number | null;
          scraped_at?: string;
          source_url?: string | null;
        };
      };
      cert_history: {
        Row: {
          id: string;
          cert_number: string;
          grading_company_id: string;
          card_id: string | null;
          grade: number;
          subgrades: Json | null;
          cert_date: string | null;
          holder_generation: string | null;
          holder_type: string | null;
          is_reholder: boolean;
          previous_cert_number: string | null;
          crossover_from: string | null;
          grade_history: Json;
          is_verified: boolean;
          last_verified_at: string | null;
          is_suspicious: boolean;
          suspicion_reason: string | null;
          raw_data: Json | null;
          scraped_at: string;
        };
        Insert: {
          id?: string;
          cert_number: string;
          grading_company_id: string;
          card_id?: string | null;
          grade: number;
          subgrades?: Json | null;
          cert_date?: string | null;
          holder_generation?: string | null;
          holder_type?: string | null;
          is_reholder?: boolean;
          previous_cert_number?: string | null;
          crossover_from?: string | null;
          grade_history?: Json;
          is_verified?: boolean;
          last_verified_at?: string | null;
          is_suspicious?: boolean;
          suspicion_reason?: string | null;
          raw_data?: Json | null;
          scraped_at?: string;
        };
        Update: {
          id?: string;
          cert_number?: string;
          grading_company_id?: string;
          card_id?: string | null;
          grade?: number;
          subgrades?: Json | null;
          cert_date?: string | null;
          holder_generation?: string | null;
          holder_type?: string | null;
          is_reholder?: boolean;
          previous_cert_number?: string | null;
          crossover_from?: string | null;
          grade_history?: Json;
          is_verified?: boolean;
          last_verified_at?: string | null;
          is_suspicious?: boolean;
          suspicion_reason?: string | null;
          raw_data?: Json | null;
          scraped_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          settings: Json;
          is_premium: boolean;
          premium_until: string | null;
          total_collection_value: number;
          cards_count: number;
          is_founding_collector: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          settings?: Json;
          is_premium?: boolean;
          premium_until?: string | null;
          total_collection_value?: number;
          cards_count?: number;
          is_founding_collector?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          settings?: Json;
          is_premium?: boolean;
          premium_until?: string | null;
          total_collection_value?: number;
          cards_count?: number;
          is_founding_collector?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      collections: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: CollectionType;
          description: string | null;
          is_public: boolean;
          anonymous_share: boolean;
          share_token: string | null;
          total_value: number;
          total_cost_basis: number;
          items_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type?: CollectionType;
          description?: string | null;
          is_public?: boolean;
          anonymous_share?: boolean;
          share_token?: string | null;
          total_value?: number;
          total_cost_basis?: number;
          items_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: CollectionType;
          description?: string | null;
          is_public?: boolean;
          anonymous_share?: boolean;
          share_token?: string | null;
          total_value?: number;
          total_cost_basis?: number;
          items_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      collection_items: {
        Row: {
          id: string;
          collection_id: string;
          card_id: string;
          variant_id: string | null;
          grade: string;
          grading_company_id: string | null;
          cert_number: string | null;
          cost_basis: number | null;
          cost_basis_source: string;
          fees: number;
          acquisition_date: string | null;
          acquisition_type: AcquisitionType;
          acquisition_source: string | null;
          notes: string | null;
          current_value: number | null;
          value_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          card_id: string;
          variant_id?: string | null;
          grade?: string;
          grading_company_id?: string | null;
          cert_number?: string | null;
          cost_basis?: number | null;
          cost_basis_source?: string;
          fees?: number;
          acquisition_date?: string | null;
          acquisition_type?: AcquisitionType;
          acquisition_source?: string | null;
          notes?: string | null;
          current_value?: number | null;
          value_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          card_id?: string;
          variant_id?: string | null;
          grade?: string;
          grading_company_id?: string | null;
          cert_number?: string | null;
          cost_basis?: number | null;
          cost_basis_source?: string;
          fees?: number;
          acquisition_date?: string | null;
          acquisition_type?: AcquisitionType;
          acquisition_source?: string | null;
          notes?: string | null;
          current_value?: number | null;
          value_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      price_alerts: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          variant_id: string | null;
          grade: string;
          grading_company_id: string | null;
          threshold_percent: number;
          direction: AlertDirection;
          baseline_price: number | null;
          is_active: boolean;
          last_triggered: string | null;
          trigger_count: number;
          delivery_method: DeliveryMethod;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          variant_id?: string | null;
          grade?: string;
          grading_company_id?: string | null;
          threshold_percent: number;
          direction?: AlertDirection;
          baseline_price?: number | null;
          is_active?: boolean;
          last_triggered?: string | null;
          trigger_count?: number;
          delivery_method?: DeliveryMethod;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          variant_id?: string | null;
          grade?: string;
          grading_company_id?: string | null;
          threshold_percent?: number;
          direction?: AlertDirection;
          baseline_price?: number | null;
          is_active?: boolean;
          last_triggered?: string | null;
          trigger_count?: number;
          delivery_method?: DeliveryMethod;
          created_at?: string;
        };
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_type: AchievementType;
          earned_at: string;
          is_founding_collector: boolean;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_type: AchievementType;
          earned_at?: string;
          is_founding_collector?: boolean;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          achievement_type?: AchievementType;
          earned_at?: string;
          is_founding_collector?: boolean;
          metadata?: Json | null;
        };
      };
      price_suggestions: {
        Row: {
          id: string;
          card_id: string;
          variant_id: string | null;
          grade: string;
          suggested_price: number;
          user_id: string;
          reasoning: string | null;
          upvotes: number;
          downvotes: number;
          is_graduated: boolean;
          graduated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          variant_id?: string | null;
          grade?: string;
          suggested_price: number;
          user_id: string;
          reasoning?: string | null;
          upvotes?: number;
          downvotes?: number;
          is_graduated?: boolean;
          graduated_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          variant_id?: string | null;
          grade?: string;
          suggested_price?: number;
          user_id?: string;
          reasoning?: string | null;
          upvotes?: number;
          downvotes?: number;
          is_graduated?: boolean;
          graduated_at?: string | null;
          created_at?: string;
        };
      };
      trending_scores: {
        Row: {
          id: string;
          card_id: string;
          price_change_24h: number;
          volume_24h: number;
          search_count_24h: number;
          social_mentions_24h: number;
          combined_score: number;
          calculated_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          price_change_24h?: number;
          volume_24h?: number;
          search_count_24h?: number;
          social_mentions_24h?: number;
          combined_score?: number;
          calculated_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          price_change_24h?: number;
          volume_24h?: number;
          search_count_24h?: number;
          social_mentions_24h?: number;
          combined_score?: number;
          calculated_at?: string;
        };
      };
      search_analytics: {
        Row: {
          id: string;
          card_id: string | null;
          search_query: string;
          user_id: string | null;
          session_id: string | null;
          result_clicked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id?: string | null;
          search_query: string;
          user_id?: string | null;
          session_id?: string | null;
          result_clicked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string | null;
          search_query?: string;
          user_id?: string | null;
          session_id?: string | null;
          result_clicked?: boolean;
          created_at?: string;
        };
      };
      set_completion: {
        Row: {
          id: string;
          user_id: string;
          set_id: string;
          base_cards_owned: number;
          base_cards_total: number;
          base_completion_percent: number;
          plus_cards_owned: number;
          plus_cards_total: number;
          plus_completion_percent: number;
          base_completed_at: string | null;
          plus_completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          set_id: string;
          base_cards_owned?: number;
          base_cards_total: number;
          base_completion_percent?: number;
          plus_cards_owned?: number;
          plus_cards_total: number;
          plus_completion_percent?: number;
          base_completed_at?: string | null;
          plus_completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          set_id?: string;
          base_cards_owned?: number;
          base_cards_total?: number;
          base_completion_percent?: number;
          plus_cards_owned?: number;
          plus_cards_total?: number;
          plus_completion_percent?: number;
          base_completed_at?: string | null;
          plus_completed_at?: string | null;
          updated_at?: string;
        };
      };
      notification_queue: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          data: Json;
          is_read: boolean;
          is_sent_email: boolean;
          is_sent_push: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body?: string | null;
          data?: Json;
          is_read?: boolean;
          is_sent_email?: boolean;
          is_sent_push?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string | null;
          data?: Json;
          is_read?: boolean;
          is_sent_email?: boolean;
          is_sent_push?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      calculate_trending_score: {
        Args: {
          p_price_change: number;
          p_volume: number;
          p_searches: number;
          p_social: number;
        };
        Returns: number;
      };
    };
    Enums: {
      variant_type: VariantType;
      price_source: PriceSource;
      price_confidence: PriceConfidence;
      collection_type: CollectionType;
      acquisition_type: AcquisitionType;
      alert_direction: AlertDirection;
      delivery_method: DeliveryMethod;
      achievement_type: AchievementType;
      notification_type: NotificationType;
    };
  };
}

// Helper types for common patterns
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
