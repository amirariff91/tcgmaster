import 'dotenv/config';
import { pool } from '../lib/db/client';

async function migrateAuthIdentities(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to migrate Better Auth identities');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO "user" (
        "id",
        "email",
        "name",
        "emailVerified",
        "image",
        "createdAt",
        "updatedAt"
      )
      SELECT
        id,
        email,
        COALESCE(NULLIF(display_name, ''), split_part(email, '@', 1)),
        true,
        avatar_url,
        COALESCE(created_at, NOW()),
        COALESCE(updated_at, created_at, NOW())
      FROM public.users
      ON CONFLICT ("id") DO UPDATE SET
        "email" = EXCLUDED."email",
        "name" = EXCLUDED."name",
        "image" = EXCLUDED."image",
        "updatedAt" = EXCLUDED."updatedAt"
    `);

    const result = await client.query<{ id: string; email: string }>(`
      SELECT "id", "email"
      FROM "user"
      WHERE "id" IN (SELECT id FROM public.users)
      ORDER BY "id"
    `);

    const sourceResult = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM public.users',
    );
    const sourceCount = Number(sourceResult.rows[0]?.count ?? 0);

    if (result.rowCount !== sourceCount) {
      throw new Error(
        `Identity migration verification failed: expected ${sourceCount} rows, found ${result.rowCount}`,
      );
    }

    const orphanCollectionResult = await client.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM public.collections AS collections
      LEFT JOIN "user" AS auth_users ON auth_users."id" = collections.user_id
      WHERE auth_users."id" IS NULL
    `);
    const orphanCollectionCount = Number(orphanCollectionResult.rows[0]?.count ?? 0);

    if (orphanCollectionCount > 0) {
      throw new Error(
        `Identity migration verification failed: ${orphanCollectionCount} collections have no Better Auth user`,
      );
    }

    await client.query('COMMIT');

    console.log(`Migrated ${result.rowCount} Better Auth identities with preserved ids.`);
    console.log('Verified that all collection owner ids resolve to Better Auth users.');
    for (const row of result.rows) {
      console.log(`${row.id} ${row.email}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

await migrateAuthIdentities();
