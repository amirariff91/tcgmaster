# WP7 adjudicated resolver fixes

- PriceCharting resolver searches raw result rows, applies the shared qualifier/language/game taxonomy, and follows accept/reject/unknown/no-match precedence. Existing single-result fetch behavior remains unchanged.
- Resolver candidate routing now scopes each source to the correct OP/DBFW language slugs, avoids persistent skip starvation within a loop run, and processes evidence-marked reverification mappings with forced fresh writes.
- Seeding now excludes `-ja` dictionary entries, expanded base-product variant collisions, and confirmed dictionary pairs with manual corrections; each exclusion is reported. Unique-product variants remain eligible.
- Reverification flags are stored in mapping evidence. Drift quarantine compares normalized external sets only; accepted anchored observations backfill missing mapping evidence, and TCGPlayer card metadata updates are source-scoped to accepted observations.
- Added coverage for PriceCharting selection precedence, game mismatch, sold-out identity, reverification marking, set drift, evidence backfill, and source-scoped card updates.

## Verification

- `npx vitest run`: 66 tests passed.
- `npx tsc --noEmit`: only the pre-existing `app/admin/health/page.tsx` errors remain.
- Changed scripts also pass a focused strict TypeScript check.
- Resolver and seed scripts were not run against the database. No commit was made.
