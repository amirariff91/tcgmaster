# Wave 5 kickoff prompt (saved copy — paste into a fresh Claude Code session; add tokens inline)

Continue the tcgmaster price-layer overhaul at Wave 5 (WP8a/WP8b/WP8c: card_price_current,
repoint readers, drop price_cache). Orchestrate gpt-5.6-luna subagents for implementation;
you verify, reconcile, and run all DB/deploy actions yourself.

## Read first (in this order)
1. feature-research/price-overhaul/progress.md — full ledger of waves 0–4.
2. ~/.claude/plans/pls-read-docs-price-architecture-review-elegant-conway.md — approved
   plan; execute sections WP8a, WP8b, WP8c.
3. docs/price-architecture-review.md §1 (three-store design) and §5 step 8.

## Current state (as of 2026-07-28 ~12:00 UTC — re-verify, don't trust)
- Waves 0–4 shipped. main = e31d62b on origin; scrapers deployed at that build (verify
  boot `build=` lines via Coolify logs, app uuid wkbf6vskjg5jc51ahhkg5ucn). Web app
  (uuid wsw8ckc8k0ks8sowgo8sgo4o) deployed with NEXT_PUBLIC_IMAGE_CDN baked in — R2
  image cutover LIVE (do NOT delete Supabase Storage; rollback path).
- WP7 live: pricers fetch ONLY by card_source_mapping anchors (confirmed|derived); no
  mapping → no price + skip-with-advance. Resolver (`scraper-resolver` PM2 app, PC
  source, 20s cadence) is building PriceCharting mappings; EN/JA catalogue
  discrimination verified on first accepts. ~11.3k mappings seeded (dictionary
  confirmed/derived, product-id, urls). Evidence backfill arms drift protection on
  first accepted fetch; drift = normalized external_set mismatch → 'title-drift'
  quarantine + evidence.reverify flag → resolver reverify queue.
- price_kind enum value is **sold_guide** (not sold_median). Migration naming
  YYYYMMDDHHMMSS_desc.sql, apply via Supabase MCP (project mquqwlxqrsvfflsgfhmi),
  mirror to repo. price_history UPDATE/DELETE revoked; price_cache has UNIQUE(card_id).
- Vitest: `npx vitest run` (66 tests green at merge). tsc: ignore pre-existing
  app/admin/health errors.

## First actions — Wave-4 soak review BEFORE any WP8 code
1. Resolver soak (the deferred PC qualifier review): pull scraper logs, tally
   RESOLVER-ACCEPT/REJECT/SKIP/NOMATCH + RESOLVER-UNKNOWN-QUALIFIER-TALLY lines.
   Unknown qualifiers → add rows to source_qualifiers (data, not code) after review.
   Spot-check ~10 accepted PC mappings in SQL: external_title contains the number,
   external_set catalogue matches game+language. Check reject rate (Krillin rule) sane.
2. Quarantine stream since 2026-07-28 11:25Z: `SELECT reason, source, count(*) FROM
   price_quarantine WHERE observed_at > '2026-07-28 11:25' GROUP BY 1,2` — investigate
   any title-drift entries (new set-drift semantics; false positives would mean the
   set normalization needs loosening) and any new reason class.
3. Coverage delta: cards with fresh price_history per source per day vs pre-WP7
   baseline; PriceCharting rows were expected to PAUSE and resume as the resolver maps
   pairs — confirm the resume is happening (mapping count growth per hour).
4. Verify PC PSA10 graded rows are appearing again (label-parse of the 'PSA 10' cell on
   product pages was new in WP7b — first graded observations post-mapping prove it).
5. R2: confirm with the user that Supabase Storage egress is falling; CF analytics for
   images.tcgmaster.com rising. Storage decommission stays OUT of scope.

Only proceed to WP8 when 1–4 look healthy; anything anomalous gets fixed first.

## WP8 specifics beyond the plan file
- WP8a: `card_price_current` PK card_id; `source_prices` jsonb keyed by source with
  {usd, native, currency, kind, recorded_at}; headline_* columns record the
  selectHeadline decision; trigger mirrors headline_cents → cards.price_cache_ttl
  (read-only mirror for search rank); write-path does a REAL upsert (PK exists) and
  keeps the price_cache compat write until WP8c; stops writing cards.price_cache_ttl
  directly (trigger owns it). Backfill from newest price_history per (card, source,
  grade) through selectHeadline (~10.9k priced cards expected — re-verify count).
- WP8b: repoint every reader (card/set/game pages, trending cron, portfolio, alerts,
  collections items, from-cert) to card_price_current PK lookups; DELETE the
  render-time price_cache_ttl write in app/[game]/[set]/[card]/page.tsx (~:370-381 in
  the plan's tree — re-locate); label prices by recorded kind (kills the "Near Mint"
  min() substitution); remove lib/ppt/client.ts fabricated condition multipliers
  (return nulls); deregister Inngest syncPrices/syncSetPrices; remove
  lib/ppt/service.ts price_cache_ttl:3600 write; regenerate database.types.ts via MCP.
- WP8c (**pause for user approval**): remove compat write, then drop price_cache —
  ONLY after web AND scrapers AND Inngest are all verified running WP8b builds
  (boot lines / deploy commit checks, not "merged").
- Deploy coupling is TRIPLE for WP8c: web, scrapers, Inngest (ships with web).

## Orchestration rules (unchanged)
- Luna workers in orchestrator-made worktrees off main (`git worktree add
  ../tcgmaster-wt/<name> -b <branch> main`), explicit file allowlists, workers never
  commit, ≤3 concurrent; `codex exec -s workspace-write -C <worktree> -m gpt-5.6-luna
  -c model_reasoning_effort=xhigh "<self-contained prompt>"`. `rm node_modules && npm
  install` in worktrees that run tests (symlinked node_modules breaks next build too).
- Every package: Fable reviews the diff, `npx vitest run` + `npx tsc --noEmit`,
  targeted probes (`bun run scripts/price-engine/scrape-once.ts --slug <slug>` hits
  prod DB — sanctioned). Critical packages (DB, readers, scrapers): `codex exec review
  --base <base> -m gpt-5.6-sol -c model_reasoning_effort=xhigh` FROM INSIDE the
  worktree (cd first — `-C` after `review` is rejected); adjudicate every finding
  yourself; luna fix-worker for accepted findings; re-verify.
- DB: apply via MCP; PAUSE for explicit user approval before anything destructive
  (WP8c drop, any DELETE). Dry-run SELECT counts shown first.
- Deploys via Coolify API (ask user for the API token — the 2026-07-28 session's
  token worked; earlier ones were dead): POST /api/v1/deploy?uuid=<app>&force=false,
  poll /api/v1/deployments/<deployment_uuid>, then verify boot lines via
  /api/v1/applications/<uuid>/logs. Env field is `is_buildtime`.
- PriceCharting from the local machine hits a Cloudflare challenge — local PC probes
  are inconclusive (fail-closed); prod logs are the source of truth for PC behavior.
- Keep progress.md current after every gate. Playwright e2e exists for WP8b page
  verification (`npm run test:e2e`) — plus manual curl checks of card/set/game pages.

## Open follow-ups (not this wave unless trivial)
- Rotate the Cloudflare API token (exposed in transcripts) and swap Coolify R2 creds
  to a dedicated bucket-scoped R2 token (graceful fallback makes this safe).
- Residual direct price_history writers (daily-snapshot.ts etc.) bypass identity —
  flagged follow-up from the plan.
- Yuyutei P-promo class (number-less titles) unmapped by design; needs a
  stronger-signal resolver heuristic later.

Start by reading the three documents, then run the soak review, then present your
Wave 5 execution plan (packages, worktrees, gates) before dispatching workers.
