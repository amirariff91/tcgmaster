# WP7a worker notes

Implemented the source-mapping seed and resolver layer in the requested files.

- `seed-source-mappings.ts` paginates cards and existing mappings, seeds the original dictionary as confirmed, expanded-only entries and existing IDs/URLs as derived, reports orphaned dictionary slugs and suspect URLs, and writes in 500-row batches. `--dry-run` performs reads and reporting only.
- `resolver-logic.ts` is pure and unit-tested for identity, qualifier, printing, language, set, and number decisions.
- `resolver.ts` resolves unmapped source rows with the existing search fetchers, records accepted/rejected mappings, leaves skips and search misses unmapped, tallies unknown qualifiers, and retries transient database failures with worker-style backoff.
- PM2 now supervises the PriceCharting resolver loop as `scraper-resolver`.

Concerns:

- Resolver search mode deliberately passes card numbers rather than persisted URLs or TCGPlayer IDs, so it can repair a bad URL/anchor instead of ratcheting it forward.
- Candidate exclusion is done after ordered 1,000-row card pages. This avoids constructing an oversized PostgREST `id not in (...)` URL as mapping coverage grows while preserving slug ordering and the requested limit.
- The resolver intentionally leaves unknown qualifiers and identity/language mismatches unmapped; those are visible in its logs for taxonomy or catalogue follow-up.

Verification:

- `npx vitest run`: 7 files, 49 tests passed.
- `npx tsc --noEmit`: only the pre-existing `app/admin/health/page.tsx` errors remain.
- Both Bun CLI entrypoints bundle successfully; neither CLI was executed against the production database.
- No commit was made.
