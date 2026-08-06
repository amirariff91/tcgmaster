import type { SupabaseClient } from '@supabase/supabase-js';
import type { CookieParam } from 'puppeteer';

export interface PopulationCard {
  id: string;
  name: string;
  slug: string;
  number: string;
  sets?: { name?: string | null } | null;
}

export type PopulationDatabase = SupabaseClient;
export type PsaCookie = CookieParam;
