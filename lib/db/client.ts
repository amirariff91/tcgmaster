import { Pool, type QueryResultRow } from 'pg'

const DEFAULT_POOL_MAX = 10
const CONNECTION_TIMEOUT_MS = 3000

function getPoolMax(): number {
  const configured = Number.parseInt(process.env.DATABASE_POOL_MAX || '', 10)

  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_POOL_MAX
}

/** A missing DATABASE_URL is a deployment configuration problem, not a DB outage. */
export class DatabaseConfigurationError extends Error {
  constructor() {
    super('DATABASE_URL is not configured; database access is unavailable')
    this.name = 'DatabaseConfigurationError'
  }
}

/**
 * One pool per Node.js process. Pool construction is lazy with respect to the
 * network: pg does not connect until the first query, which keeps imports safe
 * during builds where the database container is unreachable.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: getPoolMax(),
  connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
})

// Prevent an idle-client connection error from becoming an unhandled process error.
pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error)
})

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  if (!process.env.DATABASE_URL) {
    throw new DatabaseConfigurationError()
  }

  const result = await pool.query<T>(text, params as unknown[])
  return result.rows
}
