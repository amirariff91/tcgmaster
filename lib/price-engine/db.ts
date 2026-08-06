import { dbQuery } from '../db/client';

/** The narrow database contract used by price-engine writers and scrapers. */
export type PgQuery = typeof dbQuery;

/** Keep the old factory name for worker/script entry points while returning pg directly. */
export function createScraperClient(): PgQuery {
  return dbQuery;
}
