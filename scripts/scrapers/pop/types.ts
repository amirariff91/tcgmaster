import type { CookieParam } from 'puppeteer';
import type { PgQuery } from '../../../lib/price-engine/db';

export interface PopulationCard {
  id: string;
  name: string;
  slug: string;
  number: string;
  sets?: { name?: string | null } | null;
}

export type PopulationDatabase = PgQuery;
export type PsaCookie = CookieParam;
