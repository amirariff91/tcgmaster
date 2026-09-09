# Post-overhaul follow-ups kickoff prompt (saved copy — paste into a fresh Claude Code
# session; add the Coolify token inline where marked)

Continue tcgmaster post-price-overhaul cleanup. The overhaul (WP1–WP8c) is COMPLETE:
price_cache is DROPPED, card_price_current is the sole current-price store, all readers
repointed, scrapers+web deployed at 27bef70. This session is the follow-up sweep —
small, independent packages. Orchestrate gpt-5.6-luna workers only where a package is
big enough to warrant it; do trivial ones yourself (light lane).

Coolify API token: <PASTE TOKEN>  (POST /api/v1/deploy?uuid=<app>&force=false; scrapers
uuid wkbf6vskjg5jc51ahhkg5ucn, web uuid wsw8ckc8k0ks8sowgo8sgo4o; verify boot `build=`
lines via /api/v1/applications/<uuid>/logs)

## Read first
1. feature-research/price-overhaul/progress.md — "Wave 5 COMPLETE" section lists these
   follow-ups and all context.
2. This file's task specs below. DB = Supabase MCP project mquqwlxqrsvfflsgfhmi.
   Migration naming YYYYMMDDHHMMSS_desc.sql. Vitest baseline 75 green
   (`npx vitest run`); tsc must stay clean except pre-existing errors noted per task.

## Tasks (independent — pick order by risk; 1–3 are code, 4–6 are ops/soak)

### 1. Dead-code sweep: price_cache remnants (light lane or one luna worker)
- DELETE unregistered Inngest function bodies referencing the dropped table:
  inngest/functions/sync-prices.ts (syncPrices/syncSetPrices — deregistered in WP8b),
  inngest/functions/scrape-prices.ts. Remove their exports from inngest/functions
  index and any dangling imports/types. They were never-working writers (42P10).
- DELETE dead scripts referencing price_cache: scripts/check-db.ts, check-db2.ts,
  nuke-prices.ts, test-two-phase.ts, generate-trending.ts, check-scrape-progress.ts,
  check-schema2.ts, refactor-search.ts, seed-price-history.ts, test-card-data.ts,
  DANGEROUS_DO_NOT_RUN_sync-prices.ts, seed-dbfw-ja-safe.ts, seed-cardrush.ts —
  VERIFY each is dead first (no package.json script, no import, no PM2 entry) and
  list any survivor you left with reason.
- Acceptance: `grep -rn "price_cache" app lib scripts inngest --include='*.ts*'`
  returns only price_cache_ttl mirror READS (search/service.ts, page ordering) and
  database.types.ts residue (task 2 owns that). Build + vitest green. Deploy web.

### 2. database.types.ts full regeneration (own pass — luna worker)
- `mcp supabase generate_typescript_types` output now has schema-wide nullability
  drift vs the hand-aged file (Wave-5 finding: full regen broke app/collection/page.tsx
  (total_cost_basis/total_value possibly-null) and app/page.tsx (image_url null vs
  string) — expect more).
- Regenerate fully, drop it in, then fix EVERY resulting tsc error properly
  (null-guards, not `!`). Also removes dropped price_cache table types and the
  hand-spliced card_price_current block (keep semantics identical).
- Known pre-existing failures allowed to persist ONLY if untouched by the regen:
  app/admin/health/page.tsx. Acceptance: npx tsc --noEmit clean otherwise;
  vitest green; next build green; deploy web.

### 3. Residual direct price_history writers (flagged since the original plan)
- scripts/price-engine/… and scripts/daily-snapshot.ts (verify current list by
  grepping `.from('price_history')` outside lib/price-engine) bypass identity/
  quarantine and the append-only intent. Adjudicate per writer: delete if dead,
  or route through persistObservations if genuinely needed (daily-snapshot most
  likely candidate). Do NOT touch lib/price-engine internals.

### 4. Soak review (do FIRST, ~10 min, informs nothing else — just health)
- PC mapping growth: `SELECT count(*) FROM card_source_mapping WHERE
  source='pricecharting'` vs ~11 at 2026-07-28 12:00Z (~39/hr expected). If stalled,
  read scraper logs for RESOLVER-* lines.
- **PC PSA10 watch item**: `SELECT count(*) FROM price_history WHERE grade='psa10'`
  — should be >0 once the resolver reaches OP cards with PSA cells. If PC-mapped OP
  cards exist but psa10 rows stay 0, the WP7b label-parse ('PSA 10' cell) is broken:
  investigate pricecharting.ts anchor path.
- Quarantine: `SELECT reason, source, count(*) FROM price_quarantine WHERE
  observed_at > now()-interval '24 hours' GROUP BY 1,2` — known-healthy classes are
  yuyutei number-mismatch (P-promos, righteous) + sold-out. Anything else: investigate.
- card_price_current freshness: count rows with computed_at in last 24h vs total
  (10,748 at backfill); merge semantics mean per-source recorded_at is the true
  freshness signal.

### 5. Supabase Storage decommission (ONLY if user confirms healthy R2 window)
- Preconditions (ask user / check dashboards): Supabase egress ~zero for several
  days; images.tcgmaster.com CF analytics carrying the traffic; no fresh renders
  referencing supabase.co/storage (grep live HTML of home/set/card/deck pages).
- R2 copy was verified complete 15,024/15,024 (2026-07-28). Then: delete objects in
  the Supabase Storage card-images bucket (keep the empty bucket), PAUSE for explicit
  user approval before deletion. Rollback after deletion = re-copy from R2.

### 6. Token hygiene (user-driven, prompt them)
- Rotate the Cloudflare API token exposed in earlier transcripts; swap Coolify R2 env
  to a dedicated bucket-scoped R2 token (graceful fallback makes this safe).
- The Coolify API token in this prompt should also be rotated after the session.

## Known accepted states (do NOT "fix")
- Pokemon has NO scheduled price publisher — request-time PPT fallback only. By
  design until a Pokemon scraper/publisher is scoped properly.
- price_cache_ttl on cards is a trigger-owned read-only mirror of
  card_price_current.headline_cents — search ranking reads it; leave it.
- Yuyutei P-promo class (number-less titles) unmapped by design.
- graded_prices empty in card_price_current until graded observations resume (PC PSA10).
- source_prices entries can be stale per-source (merge keeps last accepted value;
  quarantined sources keep their old entry) — intended.

## Orchestration rules (unchanged from overhaul)
- Luna workers in orchestrator-made worktrees off main, explicit file allowlists,
  workers never commit, ≤3 concurrent; `codex exec -s workspace-write -C <worktree>
  -m gpt-5.6-luna -c model_reasoning_effort=xhigh "<self-contained prompt>"`.
  `npm install` fresh in worktrees that build (no symlinked node_modules).
- Fable reviews every diff; `npx vitest run` + `npx tsc --noEmit` + targeted probes.
  Critical packages (task 2 is; task 1 if the diff is large): `codex exec review
  --base <base> -m gpt-5.6-sol -c model_reasoning_effort=xhigh` from INSIDE the
  worktree; adjudicate findings yourself.
- DB via MCP; PAUSE for user approval before anything destructive (task 5 deletion).
- next build needs .env.local copied into the worktree (worker sandboxes can't fetch
  Google Fonts — run builds yourself outside the sandbox).
- Keep progress.md current after every gate.

Start with task 4 (soak), report health, then propose which of 1–3 to run and in what
order before dispatching workers.
