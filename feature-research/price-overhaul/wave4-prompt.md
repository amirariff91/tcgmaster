# Wave 4 kickoff prompt (saved copy — paste into a fresh Claude Code session)

Continue the tcgmaster price-layer overhaul at Wave 4 (WP7a/WP7b: the resolver/pricer
split). Orchestrate gpt-5.6-luna subagents for all implementation; you verify, reconcile,
and run all DB/deploy actions yourself.

## Read first (in this order)
1. feature-research/price-overhaul/progress.md — full state ledger of waves 0–3.
2. ~/.claude/plans/pls-read-docs-price-architecture-review-elegant-conway.md — approved
   plan; execute sections WP7a and WP7b.
3. docs/price-architecture-review.md §2 and §5 — the design rationale (mapping table,
   qualifier taxonomy, Krillin catalogue-gap rule, language verification).

## Current state (verified 2026-07-28)
- Waves 0–3 shipped. Scrapers live on Coolify app `tcgmaster-scrapers`
  (uuid wkbf6vskjg5jc51ahhkg5ucn) at main ≥ dff0953; boot log prints
  `boot build=<SOURCE_COMMIT>` — always verify this line after deploys, never trust
  "merged" as "running".
- Shared modules on main: lib/price-engine/write-path.ts (persistObservations: identity →
  guards → quarantine → cache delete+insert → history w/ 15-min dup suppression → cards
  update LAST; throws on any error), worker.ts (runScrapeLoop, transient-DB backoff),
  identity.ts (assertIdentity; cached anchors validated by fetched TITLE only),
  guards.ts (8x trailing-median, corroboration within 2x), card-number.ts (lookaround
  boundary matcher; handles _p1 and -p1), lib/pricing/grades.ts. Vitest via `npx vitest run`.
- DB (Supabase MCP, project mquqwlxqrsvfflsgfhmi): price_history has
  currency/price_native/price_kind (enum uses **sold_guide**, not sold_median) + fill
  trigger + UPDATE/DELETE revoked; price_quarantine live (RLS on, service-role only);
  price_cache has UNIQUE(card_id). Migration naming: YYYYMMDDHHMMSS_desc.sql, mirror to
  repo after applying via MCP.
- Quarantine is live and healthy; known-accepted class: PriceCharting ~$1 floor vs
  sub-dollar cards → ratio-vs-median quarantines (pair-specific bands are welcome in WP7).
- R2 image cutover code sits unmerged on branch infra/r2-cutover (commit 76f763b) —
  COMPLETE IT as a parallel track this session (see "R2 cutover track" below).

## First actions before any WP7 code
1. Review the quarantine soak: `SELECT reason, source, count(*) FROM price_quarantine
   GROUP BY 1,2` — investigate any reason spiking beyond the known classes before
   trusting the identity layer as the resolver's foundation.
2. Confirm scrapers healthy: Coolify logs show boot build = `git rev-parse origin/main`
   and written>0 cycles.

## WP7 specifics beyond the plan file
- Seed confidence nuance: cards.tcg_player_id → (tcgplayer, product-id, derived);
  the ORIGINAL 150-entry lib/price-engine/mapping-dictionary.json on main →
  (tcgplayer, dictionary, confirmed); the EXPANDED dictionary on origin/el-newupdate
  (+1,776 entries, `git show origin/el-newupdate:lib/price-engine/mapping-dictionary.json`)
  was built by unverified vision tooling → seed those as **derived**, never confirmed.
  yuyutei_url/cardrush_url → (url, derived). Do NOT merge el-newupdate itself (it
  predates the PriceCharting remediation); cherry-pick data only.
- Resolver soak first: run with --limit 20 per source, review unknown-qualifier log and
  external_title sanity BEFORE registering the PM2 resolver for a full pass.
- WP7b (pricers fetch only by mapping) merges only after the seed + a reviewed resolver
  soak; a card with no confident mapping produces NO price (tcgcsv.ts refuse-to-guess
  generalized).

## R2 cutover track (parallel to WP7 — biggest Supabase-bill lever)
Read docs/r2-cutover-checklist.md on the infra/r2-cutover branch first. Context: card
images still serve from Supabase Storage (~19.8k objects, bucket `card-images`) and its
egress is maxing the Supabase plan; R2 bucket `tcgmaster-card-images` + custom domain
images.tcgmaster.com + Image Transformations are live; the branch adds the env-gated
resolver that host-swaps Supabase URLs to R2 (build-time flag NEXT_PUBLIC_IMAGE_CDN).
Sequence:
1. Merge infra/r2-cutover into main (review the small diff first; build must pass).
2. Ask the user for R2 S3 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
   R2_SECRET_ACCESS_KEY) — then run the FULL bucket copy yourself with rclone
   (Supabase S3 → R2; the backfill scripts only cover NULL rows, they are NOT the copy).
   Verify object counts match before proceeding.
3. Set env vars on the WEB app (uuid wsw8ckc8k0ks8sowgo8sgo4o) via the Coolify API
   (envs endpoint): NEXT_PUBLIC_IMAGE_CDN=https://images.tcgmaster.com as a BUILD-time
   variable (it is baked into the client bundle; runtime-only will not flip it), plus the
   three R2_* runtime vars. Then trigger a web deploy and poll it.
4. Verify: DevTools/curl — images served from images.tcgmaster.com via /cdn-cgi/image/,
   card grid + detail + search + deck pages render; purge/revalidate stale ISR pages.
5. Confirm with the user that Supabase Storage egress starts falling; only after a
   healthy window may Supabase Storage be considered for cleanup (do NOT delete source
   objects this session — rollback path).

## Orchestration rules (unchanged from waves 0–3)
- Workers: `codex exec -s workspace-write -C <worktree> -m gpt-5.6-luna
  -c model_reasoning_effort=xhigh "<self-contained prompt>"` — one writer per
  git worktree off main (`git worktree add ../tcgmaster-wt/<name> -b <branch> main`),
  explicit file allowlists, workers never commit, ≤3 concurrent.
- Worktree setup: copy .env.local in; `rm node_modules && npm install` inside if the
  package needs to run tests (symlink to main's node_modules is fine for read-only lint).
- Every package: Fable reviews the diff, runs `npx vitest run && npx tsc --noEmit`
  (ignore pre-existing app/admin/health errors) + targeted probes
  (`bun run scripts/price-engine/scrape-once.ts --slug <slug>` hits prod DB — safe,
  same writes as production), commits with trailer
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Critical packages (DB, scrapers): `codex exec review --base main -m gpt-5.6-sol
  -c model_reasoning_effort=xhigh` from the worktree before merging; adjudicate every
  finding yourself (subagent output is advisory; first-cycle production verification
  catches what reviews miss — read the first quarantine/log entries, don't assume).
- DB changes: apply via Supabase MCP; PAUSE for explicit user approval before anything
  destructive (deletes, revokes, drops). Purge criteria always get a dry-run SELECT shown
  to the user with real counts first.
- Deploys: `curl -X POST -H "Authorization: Bearer <coolify token — ask user>"
  "https://coolify.amirariff.com/api/v1/deploy?uuid=wkbf6vskjg5jc51ahhkg5ucn&force=false"`,
  poll /api/v1/deployments/<uuid>, then verify boot lines via
  /api/v1/applications/<uuid>/logs. No auto-deploy on push. The permission classifier may
  block stop/start calls — deploys have been fine.
- Keep progress current in feature-research/price-overhaul/progress.md after every gate.

Start by reading the three documents, then present your Wave 4 execution plan (packages,
worktrees, gates) before dispatching workers.
