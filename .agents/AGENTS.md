# TCGMaster Agent Rules

## Credit Conservation
- **Never launch browser subagents for verification after making code changes.** Code changes are self-evident from reading the diff. Only launch browser subagents when the user *explicitly* asks for a screenshot, demo, or visual verification.

## Architecture Context (Coolify)
- **Coolify Migration**: As of August 2026, this repository was handed off to a friend and is designed to run on a self-hosted **Coolify** instance rather than Vercel/Supabase Cloud. The database is a self-hosted Supabase instance.
- **Environment Variables**: Always refer users to `.env.example` when discussing configuration, as self-hosted keys differ from cloud keys.
