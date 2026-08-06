# TCGMaster Agent Rules

## Credit Conservation
- **Never launch browser subagents for verification after making code changes.** Code changes are self-evident from reading the diff. Only launch browser subagents when the user *explicitly* asks for a screenshot, demo, or visual verification.

## Architecture Context (self-hosted Coolify)
- **Self-hosted**: This repo runs on a self-hosted **Coolify** instance (miccy-nano), not Vercel/Supabase Cloud. Since 2026-08-06 it uses **plain Postgres 16** (`pg`, `lib/db/client.ts`) for all data and **Better Auth** (`lib/auth.ts`) for auth — not supabase-js. Legacy `NEXT_PUBLIC_SUPABASE_*`/`SUPABASE_SECRET_KEY` env vars are retained only for rollback.
- **Environment Variables**: Always refer users to `.env.example` when discussing configuration; self-hosted keys differ from cloud keys.
