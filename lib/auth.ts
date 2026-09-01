import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';
import { dbQuery, pool } from '@/lib/db/client';

// Production MUST set BETTER_AUTH_SECRET and BETTER_AUTH_URL. There is no safe
// fallback: a committed or localhost value makes sessions forgeable / cookies
// non-secure. Fail closed in production rather than degrade silently.
const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (process.env.NODE_ENV === 'production' && !secret) {
  throw new Error('BETTER_AUTH_SECRET is required in production — sessions would be forgeable without it');
}
if (process.env.NODE_ENV === 'production' && !baseURL) {
  throw new Error('BETTER_AUTH_URL is required in production — callbacks and cookies would use localhost');
}

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const socialProviders = googleClientId && googleClientSecret
  ? {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      },
    }
  : undefined;

interface BetterAuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

async function provisionPublicUser(user: BetterAuthUser): Promise<void> {
  const displayName = (user.name.trim() || user.email.split('@')[0]).slice(0, 100);
  const avatarUrl = user.image?.slice(0, 512) ?? null;

  await dbQuery(
    `
      INSERT INTO public.users (
        id,
        email,
        display_name,
        avatar_url,
        is_founding_collector
      )
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        updated_at = NOW()
    `,
    [user.id, user.email, displayName, avatarUrl],
  );

  await dbQuery(
    `
      INSERT INTO public.collections (user_id, name, type, is_public)
      SELECT $1, 'My Collection', 'personal', false
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.collections
        WHERE user_id = $1
          AND name = 'My Collection'
      )
    `,
    [user.id],
  );
}

export const auth = betterAuth({
  appName: 'TCGMaster',
  baseURL,
  // Keep builds useful without deployment secrets; production must set
  // BETTER_AUTH_SECRET to a stable, private value.
  secret,
  database: pool,
  advanced: {
    database: {
      // Existing public.users and collections use UUID identifiers.
      generateId: 'uuid',
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    autoSignIn: true,
  },
  socialProviders,
  databaseHooks: {
    user: {
      create: {
        after: async (user: BetterAuthUser) => {
          await provisionPublicUser(user);
        },
      },
      update: {
        after: async (user: BetterAuthUser) => {
          await provisionPublicUser(user);
        },
      },
    },
  },
  plugins: [
    magicLink({
      // Wire this callback to the application's email provider when one is
      // available. Logging keeps local development and the existing UI flow
      // observable without adding an email-provider dependency to this task.
      sendMagicLink: async ({ email, url }) => {
        console.info(`[auth] Magic link for ${email}: ${url}`);
      },
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
