export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      card_price_current: {
        Row: {
          card_id: string
          computed_at: string
          graded_prices: Json
          headline_cents: number | null
          headline_currency: string | null
          headline_grade: string | null
          headline_kind: Database["public"]["Enums"]["price_kind"] | null
          headline_source: string | null
          source_prices: Json
        }
        Insert: {
          card_id: string
          computed_at?: string
          graded_prices?: Json
          headline_cents?: number | null
          headline_currency?: string | null
          headline_grade?: string | null
          headline_kind?: Database["public"]["Enums"]["price_kind"] | null
          headline_source?: string | null
          source_prices?: Json
        }
        Update: {
          card_id?: string
          computed_at?: string
          graded_prices?: Json
          headline_cents?: number | null
          headline_currency?: string | null
          headline_grade?: string | null
          headline_kind?: Database["public"]["Enums"]["price_kind"] | null
          headline_source?: string | null
          source_prices?: Json
        }
        Relationships: [
          {
            foreignKeyName: "card_price_current_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_source_mapping: {
        Row: {
          card_id: string
          confidence: Database["public"]["Enums"]["mapping_confidence"]
          created_at: string
          evidence: Json | null
          external_id: string | null
          external_set: string | null
          external_title: string | null
          external_url: string | null
          id: string
          matched_by: string
          source: Database["public"]["Enums"]["price_source"]
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          card_id: string
          confidence: Database["public"]["Enums"]["mapping_confidence"]
          created_at?: string
          evidence?: Json | null
          external_id?: string | null
          external_set?: string | null
          external_title?: string | null
          external_url?: string | null
          id?: string
          matched_by: string
          source: Database["public"]["Enums"]["price_source"]
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          card_id?: string
          confidence?: Database["public"]["Enums"]["mapping_confidence"]
          created_at?: string
          evidence?: Json | null
          external_id?: string | null
          external_set?: string | null
          external_title?: string | null
          external_url?: string | null
          id?: string
          matched_by?: string
          source?: Database["public"]["Enums"]["price_source"]
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_source_mapping_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_variants: {
        Row: {
          card_id: string
          created_at: string | null
          id: string
          name: string
          price_multiplier: number | null
          slug: string
          tcg_player_variant_id: string | null
          variant_type: Database["public"]["Enums"]["variant_type"]
        }
        Insert: {
          card_id: string
          created_at?: string | null
          id?: string
          name: string
          price_multiplier?: number | null
          slug: string
          tcg_player_variant_id?: string | null
          variant_type: Database["public"]["Enums"]["variant_type"]
        }
        Update: {
          card_id?: string
          created_at?: string | null
          id?: string
          name?: string
          price_multiplier?: number | null
          slug?: string
          tcg_player_variant_id?: string | null
          variant_type?: Database["public"]["Enums"]["variant_type"]
        }
        Relationships: [
          {
            foreignKeyName: "card_variants_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          artist: string | null
          cardrush_url: string | null
          created_at: string | null
          curation_status: string | null
          description: string | null
          ebay_url: string | null
          historical_fetched: boolean | null
          id: string
          image_fetched_at: string | null
          image_url: string | null
          last_price_fetch: string | null
          local_image_url: string | null
          local_image_url_supabase: string | null
          lore: string | null
          name: string
          number: string
          ppt_card_id: string | null
          price_cache_ttl: number | null
          pricecharting_url: string | null
          print_run_info: string | null
          rarity: string | null
          set_id: string
          slug: string
          snkrdunk_url: string | null
          tcg_player_id: string | null
          tcgplayer_url: string | null
          updated_at: string | null
          yuyutei_url: string | null
        }
        Insert: {
          artist?: string | null
          cardrush_url?: string | null
          created_at?: string | null
          curation_status?: string | null
          description?: string | null
          ebay_url?: string | null
          historical_fetched?: boolean | null
          id?: string
          image_fetched_at?: string | null
          image_url?: string | null
          last_price_fetch?: string | null
          local_image_url?: string | null
          local_image_url_supabase?: string | null
          lore?: string | null
          name: string
          number: string
          ppt_card_id?: string | null
          price_cache_ttl?: number | null
          pricecharting_url?: string | null
          print_run_info?: string | null
          rarity?: string | null
          set_id: string
          slug: string
          snkrdunk_url?: string | null
          tcg_player_id?: string | null
          tcgplayer_url?: string | null
          updated_at?: string | null
          yuyutei_url?: string | null
        }
        Update: {
          artist?: string | null
          cardrush_url?: string | null
          created_at?: string | null
          curation_status?: string | null
          description?: string | null
          ebay_url?: string | null
          historical_fetched?: boolean | null
          id?: string
          image_fetched_at?: string | null
          image_url?: string | null
          last_price_fetch?: string | null
          local_image_url?: string | null
          local_image_url_supabase?: string | null
          lore?: string | null
          name?: string
          number?: string
          ppt_card_id?: string | null
          price_cache_ttl?: number | null
          pricecharting_url?: string | null
          print_run_info?: string | null
          rarity?: string | null
          set_id?: string
          slug?: string
          snkrdunk_url?: string | null
          tcg_player_id?: string | null
          tcgplayer_url?: string | null
          updated_at?: string | null
          yuyutei_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
        ]
      }
      cards_dedup_backup_20260722: {
        Row: {
          artist: string | null
          cardrush_url: string | null
          created_at: string | null
          description: string | null
          ebay_url: string | null
          historical_fetched: boolean | null
          id: string | null
          image_fetched_at: string | null
          image_url: string | null
          last_price_fetch: string | null
          local_image_url: string | null
          lore: string | null
          name: string | null
          number: string | null
          ppt_card_id: string | null
          price_cache_ttl: number | null
          print_run_info: string | null
          rarity: string | null
          set_id: string | null
          slug: string | null
          snkrdunk_url: string | null
          tcg_player_id: string | null
          tcgplayer_url: string | null
          updated_at: string | null
          yuyutei_url: string | null
        }
        Insert: {
          artist?: string | null
          cardrush_url?: string | null
          created_at?: string | null
          description?: string | null
          ebay_url?: string | null
          historical_fetched?: boolean | null
          id?: string | null
          image_fetched_at?: string | null
          image_url?: string | null
          last_price_fetch?: string | null
          local_image_url?: string | null
          lore?: string | null
          name?: string | null
          number?: string | null
          ppt_card_id?: string | null
          price_cache_ttl?: number | null
          print_run_info?: string | null
          rarity?: string | null
          set_id?: string | null
          slug?: string | null
          snkrdunk_url?: string | null
          tcg_player_id?: string | null
          tcgplayer_url?: string | null
          updated_at?: string | null
          yuyutei_url?: string | null
        }
        Update: {
          artist?: string | null
          cardrush_url?: string | null
          created_at?: string | null
          description?: string | null
          ebay_url?: string | null
          historical_fetched?: boolean | null
          id?: string | null
          image_fetched_at?: string | null
          image_url?: string | null
          last_price_fetch?: string | null
          local_image_url?: string | null
          lore?: string | null
          name?: string | null
          number?: string | null
          ppt_card_id?: string | null
          price_cache_ttl?: number | null
          print_run_info?: string | null
          rarity?: string | null
          set_id?: string | null
          slug?: string | null
          snkrdunk_url?: string | null
          tcg_player_id?: string | null
          tcgplayer_url?: string | null
          updated_at?: string | null
          yuyutei_url?: string | null
        }
        Relationships: []
      }
      cert_history: {
        Row: {
          card_id: string | null
          cert_date: string | null
          cert_number: string
          crossover_from: string | null
          grade: number
          grade_history: Json | null
          grading_company_id: string
          holder_generation: string | null
          holder_type: string | null
          id: string
          is_reholder: boolean | null
          is_suspicious: boolean | null
          is_verified: boolean | null
          last_verified_at: string | null
          previous_cert_number: string | null
          raw_data: Json | null
          scraped_at: string | null
          subgrades: Json | null
          suspicion_reason: string | null
        }
        Insert: {
          card_id?: string | null
          cert_date?: string | null
          cert_number: string
          crossover_from?: string | null
          grade: number
          grade_history?: Json | null
          grading_company_id: string
          holder_generation?: string | null
          holder_type?: string | null
          id?: string
          is_reholder?: boolean | null
          is_suspicious?: boolean | null
          is_verified?: boolean | null
          last_verified_at?: string | null
          previous_cert_number?: string | null
          raw_data?: Json | null
          scraped_at?: string | null
          subgrades?: Json | null
          suspicion_reason?: string | null
        }
        Update: {
          card_id?: string | null
          cert_date?: string | null
          cert_number?: string
          crossover_from?: string | null
          grade?: number
          grade_history?: Json | null
          grading_company_id?: string
          holder_generation?: string | null
          holder_type?: string | null
          id?: string
          is_reholder?: boolean | null
          is_suspicious?: boolean | null
          is_verified?: boolean | null
          last_verified_at?: string | null
          previous_cert_number?: string | null
          raw_data?: Json | null
          scraped_at?: string | null
          subgrades?: Json | null
          suspicion_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cert_history_crossover_from_fkey"
            columns: ["crossover_from"]
            isOneToOne: false
            referencedRelation: "grading_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cert_history_grading_company_id_fkey"
            columns: ["grading_company_id"]
            isOneToOne: false
            referencedRelation: "grading_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          acquisition_date: string | null
          acquisition_source: string | null
          acquisition_type:
            | Database["public"]["Enums"]["acquisition_type"]
            | null
          card_id: string
          cert_number: string | null
          collection_id: string
          cost_basis: number | null
          cost_basis_source: string | null
          created_at: string | null
          current_value: number | null
          fees: number | null
          grade: string | null
          grading_company_id: string | null
          id: string
          notes: string | null
          updated_at: string | null
          value_updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_source?: string | null
          acquisition_type?:
            | Database["public"]["Enums"]["acquisition_type"]
            | null
          card_id: string
          cert_number?: string | null
          collection_id: string
          cost_basis?: number | null
          cost_basis_source?: string | null
          created_at?: string | null
          current_value?: number | null
          fees?: number | null
          grade?: string | null
          grading_company_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          value_updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          acquisition_date?: string | null
          acquisition_source?: string | null
          acquisition_type?:
            | Database["public"]["Enums"]["acquisition_type"]
            | null
          card_id?: string
          cert_number?: string | null
          collection_id?: string
          cost_basis?: number | null
          cost_basis_source?: string | null
          created_at?: string | null
          current_value?: number | null
          fees?: number | null
          grade?: string | null
          grading_company_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          value_updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_grading_company_id_fkey"
            columns: ["grading_company_id"]
            isOneToOne: false
            referencedRelation: "grading_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "card_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          anonymous_share: boolean | null
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          items_count: number | null
          name: string
          share_token: string | null
          total_cost_basis: number | null
          total_value: number | null
          type: Database["public"]["Enums"]["collection_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          anonymous_share?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          items_count?: number | null
          name: string
          share_token?: string | null
          total_cost_basis?: number | null
          total_value?: number | null
          type?: Database["public"]["Enums"]["collection_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          anonymous_share?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          items_count?: number | null
          name?: string
          share_token?: string | null
          total_cost_basis?: number | null
          total_value?: number | null
          type?: Database["public"]["Enums"]["collection_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      content_chunks: {
        Row: {
          chunk_index: number
          chunk_source: string
          chunk_text: string
          created_at: string
          embedded_at: string | null
          embedding: string | null
          id: number
          model: string
          page_id: number
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          chunk_source?: string
          chunk_text: string
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          id?: number
          model?: string
          page_id: number
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          chunk_source?: string
          chunk_text?: string
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          id?: number
          model?: string
          page_id?: number
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_chunks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_cards: {
        Row: {
          card_id: string | null
          count: number
          created_at: string
          deck_id: string
          id: string
          raw_card_id_string: string
          raw_card_name: string | null
        }
        Insert: {
          card_id?: string | null
          count?: number
          created_at?: string
          deck_id: string
          id?: string
          raw_card_id_string: string
          raw_card_name?: string | null
        }
        Update: {
          card_id?: string | null
          count?: number
          created_at?: string
          deck_id?: string
          id?: string
          raw_card_id_string?: string
          raw_card_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deck_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_cards_dedup_backup_20260722: {
        Row: {
          card_id: string | null
          count: number | null
          created_at: string | null
          deck_id: string | null
          id: string | null
          raw_card_id_string: string | null
          raw_card_name: string | null
        }
        Insert: {
          card_id?: string | null
          count?: number | null
          created_at?: string | null
          deck_id?: string | null
          id?: string | null
          raw_card_id_string?: string | null
          raw_card_name?: string | null
        }
        Update: {
          card_id?: string | null
          count?: number | null
          created_at?: string | null
          deck_id?: string | null
          id?: string | null
          raw_card_id_string?: string | null
          raw_card_name?: string | null
        }
        Relationships: []
      }
      decks: {
        Row: {
          created_at: string
          id: string
          leader_card_id: string | null
          placement: string
          player_name: string
          source_url: string
          total_price: number | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_card_id?: string | null
          placement: string
          player_name: string
          source_url: string
          total_price?: number | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_card_id?: string | null
          placement?: string
          player_name?: string
          source_url?: string
          total_price?: number | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_leader_card_id_fkey"
            columns: ["leader_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decks_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      dedup_map_20260722: {
        Row: {
          loser_id: string | null
          loser_set_id: string | null
          loser_slug: string | null
          winner_id: string | null
          winner_set_id: string | null
          winner_slug: string | null
        }
        Insert: {
          loser_id?: string | null
          loser_set_id?: string | null
          loser_slug?: string | null
          winner_id?: string | null
          winner_set_id?: string | null
          winner_slug?: string | null
        }
        Update: {
          loser_id?: string | null
          loser_set_id?: string | null
          loser_slug?: string | null
          winner_id?: string | null
          winner_set_id?: string | null
          winner_slug?: string | null
        }
        Relationships: []
      }
      dedup_premerge_totals_20260722: {
        Row: {
          captured_at: string | null
          deck_cards_total: number | null
          onepiece_total: number | null
          op_total: number | null
          price_cache_total: number | null
          price_history_total: number | null
          trending_total: number | null
        }
        Insert: {
          captured_at?: string | null
          deck_cards_total?: number | null
          onepiece_total?: number | null
          op_total?: number | null
          price_cache_total?: number | null
          price_history_total?: number | null
          trending_total?: number | null
        }
        Update: {
          captured_at?: string | null
          deck_cards_total?: number | null
          onepiece_total?: number | null
          op_total?: number | null
          price_cache_total?: number | null
          price_history_total?: number | null
          trending_total?: number | null
        }
        Relationships: []
      }
      files: {
        Row: {
          content_hash: string
          created_at: string
          filename: string
          id: number
          metadata: Json
          mime_type: string | null
          page_slug: string | null
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          filename: string
          id?: number
          metadata?: Json
          mime_type?: string | null
          page_slug?: string | null
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          filename?: string
          id?: number
          metadata?: Json
          mime_type?: string | null
          page_slug?: string | null
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_page_slug_fkey"
            columns: ["page_slug"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["slug"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      graded_cards: {
        Row: {
          authenticated_by: string | null
          auto_grade: number | null
          card_id: string
          cert_number: string | null
          created_at: string | null
          grade: number
          grading_company_id: string
          id: string
          is_auto: boolean | null
          signer_name: string | null
          signer_tier: string | null
          variant_id: string | null
        }
        Insert: {
          authenticated_by?: string | null
          auto_grade?: number | null
          card_id: string
          cert_number?: string | null
          created_at?: string | null
          grade: number
          grading_company_id: string
          id?: string
          is_auto?: boolean | null
          signer_name?: string | null
          signer_tier?: string | null
          variant_id?: string | null
        }
        Update: {
          authenticated_by?: string | null
          auto_grade?: number | null
          card_id?: string
          cert_number?: string | null
          created_at?: string | null
          grade?: number
          grading_company_id?: string
          id?: string
          is_auto?: boolean | null
          signer_name?: string | null
          signer_tier?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "graded_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graded_cards_grading_company_id_fkey"
            columns: ["grading_company_id"]
            isOneToOne: false
            referencedRelation: "grading_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graded_cards_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "card_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_companies: {
        Row: {
          cert_lookup_url: string | null
          created_at: string | null
          grade_scale: string
          has_subgrades: boolean | null
          id: string
          max_grade: number | null
          min_grade: number | null
          name: string
          slug: string
        }
        Insert: {
          cert_lookup_url?: string | null
          created_at?: string | null
          grade_scale: string
          has_subgrades?: boolean | null
          id?: string
          max_grade?: number | null
          min_grade?: number | null
          name: string
          slug: string
        }
        Update: {
          cert_lookup_url?: string | null
          created_at?: string | null
          grade_scale?: string
          has_subgrades?: boolean | null
          id?: string
          max_grade?: number | null
          min_grade?: number | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      ingest_log: {
        Row: {
          created_at: string
          id: number
          pages_updated: Json
          source_ref: string
          source_type: string
          summary: string
        }
        Insert: {
          created_at?: string
          id?: number
          pages_updated?: Json
          source_ref: string
          source_type: string
          summary?: string
        }
        Update: {
          created_at?: string
          id?: number
          pages_updated?: Json
          source_ref?: string
          source_type?: string
          summary?: string
        }
        Relationships: []
      }
      links: {
        Row: {
          context: string
          created_at: string
          from_page_id: number
          id: number
          link_type: string
          to_page_id: number
        }
        Insert: {
          context?: string
          created_at?: string
          from_page_id: number
          id?: number
          link_type?: string
          to_page_id: number
        }
        Update: {
          context?: string
          created_at?: string
          from_page_id?: number
          id?: number
          link_type?: string
          to_page_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "links_from_page_id_fkey"
            columns: ["from_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_to_page_id_fkey"
            columns: ["to_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          is_sent_email: boolean | null
          is_sent_push: boolean | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          is_sent_email?: boolean | null
          is_sent_push?: boolean | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          is_sent_email?: boolean | null
          is_sent_push?: boolean | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      page_versions: {
        Row: {
          compiled_truth: string
          frontmatter: Json
          id: number
          page_id: number
          snapshot_at: string
        }
        Insert: {
          compiled_truth: string
          frontmatter?: Json
          id?: number
          page_id: number
          snapshot_at?: string
        }
        Update: {
          compiled_truth?: string
          frontmatter?: Json
          id?: number
          page_id?: number
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          compiled_truth: string
          content_hash: string | null
          created_at: string
          frontmatter: Json
          id: number
          search_vector: unknown
          slug: string
          timeline: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          compiled_truth?: string
          content_hash?: string | null
          created_at?: string
          frontmatter?: Json
          id?: number
          search_vector?: unknown
          slug: string
          timeline?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          compiled_truth?: string
          content_hash?: string | null
          created_at?: string
          frontmatter?: Json
          id?: number
          search_vector?: unknown
          slug?: string
          timeline?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      population_reports: {
        Row: {
          card_id: string
          count: number
          gem_rate: number | null
          grade: number
          grading_company_id: string
          id: string
          scraped_at: string | null
          source_url: string | null
          total_population: number | null
        }
        Insert: {
          card_id: string
          count?: number
          gem_rate?: number | null
          grade: number
          grading_company_id: string
          id?: string
          scraped_at?: string | null
          source_url?: string | null
          total_population?: number | null
        }
        Update: {
          card_id?: string
          count?: number
          gem_rate?: number | null
          grade?: number
          grading_company_id?: string
          id?: string
          scraped_at?: string | null
          source_url?: string | null
          total_population?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "population_reports_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "population_reports_grading_company_id_fkey"
            columns: ["grading_company_id"]
            isOneToOne: false
            referencedRelation: "grading_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          baseline_price: number | null
          card_id: string
          created_at: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"] | null
          direction: Database["public"]["Enums"]["alert_direction"] | null
          grade: string | null
          grading_company_id: string | null
          id: string
          is_active: boolean | null
          last_triggered: string | null
          threshold_percent: number
          trigger_count: number | null
          user_id: string
          variant_id: string | null
        }
        Insert: {
          baseline_price?: number | null
          card_id: string
          created_at?: string | null
          delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          direction?: Database["public"]["Enums"]["alert_direction"] | null
          grade?: string | null
          grading_company_id?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered?: string | null
          threshold_percent: number
          trigger_count?: number | null
          user_id: string
          variant_id?: string | null
        }
        Update: {
          baseline_price?: number | null
          card_id?: string
          created_at?: string | null
          delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          direction?: Database["public"]["Enums"]["alert_direction"] | null
          grade?: string | null
          grading_company_id?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered?: string | null
          threshold_percent?: number
          trigger_count?: number | null
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_grading_company_id_fkey"
            columns: ["grading_company_id"]
            isOneToOne: false
            referencedRelation: "grading_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "card_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          card_id: string
          confidence: Database["public"]["Enums"]["price_confidence"] | null
          currency: string | null
          grade: string | null
          grading_company_id: string | null
          id: string
          is_notable: boolean | null
          notable_reason: string | null
          price: number
          price_kind: Database["public"]["Enums"]["price_kind"] | null
          price_native: number | null
          recorded_at: string | null
          sale_type: string | null
          source: Database["public"]["Enums"]["price_source"]
          variant_id: string | null
        }
        Insert: {
          card_id: string
          confidence?: Database["public"]["Enums"]["price_confidence"] | null
          currency?: string | null
          grade?: string | null
          grading_company_id?: string | null
          id?: string
          is_notable?: boolean | null
          notable_reason?: string | null
          price: number
          price_kind?: Database["public"]["Enums"]["price_kind"] | null
          price_native?: number | null
          recorded_at?: string | null
          sale_type?: string | null
          source: Database["public"]["Enums"]["price_source"]
          variant_id?: string | null
        }
        Update: {
          card_id?: string
          confidence?: Database["public"]["Enums"]["price_confidence"] | null
          currency?: string | null
          grade?: string | null
          grading_company_id?: string | null
          id?: string
          is_notable?: boolean | null
          notable_reason?: string | null
          price?: number
          price_kind?: Database["public"]["Enums"]["price_kind"] | null
          price_native?: number | null
          recorded_at?: string | null
          sale_type?: string | null
          source?: Database["public"]["Enums"]["price_source"]
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_grading_company_id_fkey"
            columns: ["grading_company_id"]
            isOneToOne: false
            referencedRelation: "grading_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "card_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_quarantine: {
        Row: {
          card_id: string
          currency: string | null
          evidence: Json
          grade: string
          id: string
          observed_at: string
          price: number
          price_kind: Database["public"]["Enums"]["price_kind"] | null
          price_native: number | null
          reason: string
          resolution: string | null
          resolved_at: string | null
          source: Database["public"]["Enums"]["price_source"]
        }
        Insert: {
          card_id: string
          currency?: string | null
          evidence: Json
          grade?: string
          id?: string
          observed_at?: string
          price: number
          price_kind?: Database["public"]["Enums"]["price_kind"] | null
          price_native?: number | null
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          source: Database["public"]["Enums"]["price_source"]
        }
        Update: {
          card_id?: string
          currency?: string | null
          evidence?: Json
          grade?: string
          id?: string
          observed_at?: string
          price?: number
          price_kind?: Database["public"]["Enums"]["price_kind"] | null
          price_native?: number | null
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          source?: Database["public"]["Enums"]["price_source"]
        }
        Relationships: [
          {
            foreignKeyName: "price_quarantine_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      price_suggestions: {
        Row: {
          card_id: string
          created_at: string | null
          downvotes: number | null
          grade: string | null
          graduated_at: string | null
          id: string
          is_graduated: boolean | null
          reasoning: string | null
          suggested_price: number
          upvotes: number | null
          user_id: string
          variant_id: string | null
        }
        Insert: {
          card_id: string
          created_at?: string | null
          downvotes?: number | null
          grade?: string | null
          graduated_at?: string | null
          id?: string
          is_graduated?: boolean | null
          reasoning?: string | null
          suggested_price: number
          upvotes?: number | null
          user_id: string
          variant_id?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string | null
          downvotes?: number | null
          grade?: string | null
          graduated_at?: string | null
          id?: string
          is_graduated?: boolean | null
          reasoning?: string | null
          suggested_price?: number
          upvotes?: number | null
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_suggestions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_suggestions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "card_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_data: {
        Row: {
          data: Json
          fetched_at: string
          id: number
          page_id: number
          source: string
        }
        Insert: {
          data: Json
          fetched_at?: string
          id?: number
          page_id: number
          source: string
        }
        Update: {
          data?: Json
          fetched_at?: string
          id?: number
          page_id?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_data_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      search_analytics: {
        Row: {
          card_id: string | null
          created_at: string | null
          id: string
          result_clicked: boolean | null
          search_query: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          card_id?: string | null
          created_at?: string | null
          id?: string
          result_clicked?: boolean | null
          search_query: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          card_id?: string | null
          created_at?: string | null
          id?: string
          result_clicked?: boolean | null
          search_query?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_analytics_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      set_completion: {
        Row: {
          base_cards_owned: number | null
          base_cards_total: number
          base_completed_at: string | null
          base_completion_percent: number | null
          id: string
          plus_cards_owned: number | null
          plus_cards_total: number
          plus_completed_at: string | null
          plus_completion_percent: number | null
          set_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          base_cards_owned?: number | null
          base_cards_total: number
          base_completed_at?: string | null
          base_completion_percent?: number | null
          id?: string
          plus_cards_owned?: number | null
          plus_cards_total: number
          plus_completed_at?: string | null
          plus_completion_percent?: number | null
          set_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          base_cards_owned?: number | null
          base_cards_total?: number
          base_completed_at?: string | null
          base_completion_percent?: number | null
          id?: string
          plus_cards_owned?: number | null
          plus_cards_total?: number
          plus_completed_at?: string | null
          plus_completion_percent?: number | null
          set_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_completion_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_completion_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          card_count: number | null
          created_at: string | null
          game_id: string
          id: string
          image_url: string | null
          imported_at: string | null
          is_imported: boolean | null
          name: string
          ppt_set_id: string | null
          priority: number | null
          release_date: string | null
          slug: string
          tcg_player_group_id: string | null
        }
        Insert: {
          card_count?: number | null
          created_at?: string | null
          game_id: string
          id?: string
          image_url?: string | null
          imported_at?: string | null
          is_imported?: boolean | null
          name: string
          ppt_set_id?: string | null
          priority?: number | null
          release_date?: string | null
          slug: string
          tcg_player_group_id?: string | null
        }
        Update: {
          card_count?: number | null
          created_at?: string | null
          game_id?: string
          id?: string
          image_url?: string | null
          imported_at?: string | null
          is_imported?: boolean | null
          name?: string
          ppt_set_id?: string | null
          priority?: number | null
          release_date?: string | null
          slug?: string
          tcg_player_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sets_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      source_qualifiers: {
        Row: {
          game: string
          id: string
          means: string
          qualifier: string
          source: Database["public"]["Enums"]["price_source"]
        }
        Insert: {
          game: string
          id?: string
          means: string
          qualifier: string
          source: Database["public"]["Enums"]["price_source"]
        }
        Update: {
          game?: string
          id?: string
          means?: string
          qualifier?: string
          source?: Database["public"]["Enums"]["price_source"]
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: number
          page_id: number
          tag: string
        }
        Insert: {
          id?: number
          page_id: number
          tag: string
        }
        Update: {
          id?: number
          page_id?: number
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_entries: {
        Row: {
          created_at: string
          date: string
          detail: string
          id: number
          page_id: number
          source: string
          summary: string
        }
        Insert: {
          created_at?: string
          date: string
          detail?: string
          id?: number
          page_id: number
          source?: string
          summary: string
        }
        Update: {
          created_at?: string
          date?: string
          detail?: string
          id?: number
          page_id?: number
          source?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_entries_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          date: string
          format: string
          game_id: string | null
          id: string
          name: string
          num_players: number
          source_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          format: string
          game_id?: string | null
          id?: string
          name: string
          num_players?: number
          source_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          format?: string
          game_id?: string | null
          id?: string
          name?: string
          num_players?: number
          source_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_scores: {
        Row: {
          calculated_at: string | null
          card_id: string
          combined_score: number | null
          id: string
          price_change_24h: number | null
          search_count_24h: number | null
          social_mentions_24h: number | null
          volume_24h: number | null
        }
        Insert: {
          calculated_at?: string | null
          card_id: string
          combined_score?: number | null
          id?: string
          price_change_24h?: number | null
          search_count_24h?: number | null
          social_mentions_24h?: number | null
          volume_24h?: number | null
        }
        Update: {
          calculated_at?: string | null
          card_id?: string
          combined_score?: number | null
          id?: string
          price_change_24h?: number | null
          search_count_24h?: number | null
          social_mentions_24h?: number | null
          volume_24h?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trending_scores_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          earned_at: string | null
          id: string
          is_founding_collector: boolean | null
          metadata: Json | null
          user_id: string
        }
        Insert: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          earned_at?: string | null
          id?: string
          is_founding_collector?: boolean | null
          metadata?: Json | null
          user_id: string
        }
        Update: {
          achievement_type?: Database["public"]["Enums"]["achievement_type"]
          earned_at?: string | null
          id?: string
          is_founding_collector?: boolean | null
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          cards_count: number | null
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          is_founding_collector: boolean | null
          is_premium: boolean | null
          premium_until: string | null
          settings: Json | null
          total_collection_value: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          cards_count?: number | null
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
          is_founding_collector?: boolean | null
          is_premium?: boolean | null
          premium_until?: string | null
          settings?: Json | null
          total_collection_value?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          cards_count?: number | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          is_founding_collector?: boolean | null
          is_premium?: boolean | null
          premium_until?: string | null
          settings?: Json | null
          total_collection_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_trending_score: {
        Args: {
          p_price_change: number
          p_searches: number
          p_social: number
          p_volume: number
        }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      achievement_type:
        | "first_card"
        | "set_complete_base"
        | "set_complete_plus"
        | "first_psa_10"
        | "portfolio_1k"
        | "portfolio_10k"
        | "portfolio_100k"
        | "cards_100"
        | "cards_500"
        | "cards_1000"
        | "grade_upgrader"
        | "diversified"
        | "founding_collector"
        | "early_adopter"
        | "price_predictor"
        | "community_helper"
      acquisition_type:
        | "purchase"
        | "trade"
        | "gift"
        | "pull"
        | "grading-return"
        | "other"
      alert_direction: "up" | "down" | "both"
      collection_type:
        | "personal"
        | "investment"
        | "for-sale"
        | "wishlist"
        | "custom"
      delivery_method: "email" | "push" | "both"
      mapping_confidence: "confirmed" | "derived" | "rejected"
      notification_type:
        | "price_alert"
        | "achievement"
        | "collection_shared"
        | "system"
      price_confidence: "high" | "medium" | "low"
      price_kind:
        | "market"
        | "lowest_listing"
        | "retail_sell"
        | "sold_guide"
        | "marketplace_ask"
      price_source:
        | "ebay"
        | "tcgplayer"
        | "pwcc"
        | "goldin"
        | "heritage"
        | "user-submitted"
        | "ppt-api"
        | "yuyutei"
        | "cardrush"
        | "tcgrepublic"
        | "snkrdunk"
        | "pricecharting"
      variant_type:
        | "1st-edition"
        | "shadowless"
        | "unlimited"
        | "reverse-holo"
        | "holo"
        | "non-holo"
        | "promo"
        | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      achievement_type: [
        "first_card",
        "set_complete_base",
        "set_complete_plus",
        "first_psa_10",
        "portfolio_1k",
        "portfolio_10k",
        "portfolio_100k",
        "cards_100",
        "cards_500",
        "cards_1000",
        "grade_upgrader",
        "diversified",
        "founding_collector",
        "early_adopter",
        "price_predictor",
        "community_helper",
      ],
      acquisition_type: [
        "purchase",
        "trade",
        "gift",
        "pull",
        "grading-return",
        "other",
      ],
      alert_direction: ["up", "down", "both"],
      collection_type: [
        "personal",
        "investment",
        "for-sale",
        "wishlist",
        "custom",
      ],
      delivery_method: ["email", "push", "both"],
      mapping_confidence: ["confirmed", "derived", "rejected"],
      notification_type: [
        "price_alert",
        "achievement",
        "collection_shared",
        "system",
      ],
      price_confidence: ["high", "medium", "low"],
      price_kind: [
        "market",
        "lowest_listing",
        "retail_sell",
        "sold_guide",
        "marketplace_ask",
      ],
      price_source: [
        "ebay",
        "tcgplayer",
        "pwcc",
        "goldin",
        "heritage",
        "user-submitted",
        "ppt-api",
        "yuyutei",
        "cardrush",
        "tcgrepublic",
        "snkrdunk",
        "pricecharting",
      ],
      variant_type: [
        "1st-edition",
        "shadowless",
        "unlimited",
        "reverse-holo",
        "holo",
        "non-holo",
        "promo",
        "error",
      ],
    },
  },
} as const
