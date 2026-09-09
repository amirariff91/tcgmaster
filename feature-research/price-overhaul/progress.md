# Price-layer overhaul — progress

Plan: `~/.claude/plans/pls-read-docs-price-architecture-review-elegant-conway.md` (approved 2026-07-28)
Source review: `docs/price-architecture-review.md` (note: still untracked — commit with Wave 0)
Base: `main` @ `bd6e0e0` (PR #2 merge; contains the PriceCharting remediation)

## Wave status

| Wave | Package | Branch / worktree | Status |
|---|---|---|---|
| 0 | WP1 SnkrDunk off + purge SQL | `price/wp1-snkrdunk-off` `4e14c9e` | done, verified, merged to price/wave0 |
| 0 | WP2 grade vocabulary | `price/wp2-grade-vocab` `72c97fd` | done, verified, merged to price/wave0 |
| 0 | WP3 price_history hardening | `price/wp3-history-appendonly` `91cbd98` | done, verified, merged to price/wave0 |
| 1 | WP4 shared write path | — | pending |
| 2 | WP5 identity + quarantine | — | pending |
| 3 | WP6 price_cache dedupe+unique | — | pending (gated on wave-2 deploy verify) |
| 4 | WP7a mapping/resolver ∥ WP7b pricer | — | pending |
| 5 | WP8a card_price_current, WP8b repoint readers | — | pending |
| 6 | WP8c drop price_cache | — | pending (last) |

## Wave 0 outcome (2026-07-28)

- Merged to main `e6b5e91`, pushed to origin. Sol-xhigh review: 6 findings, 5 fixed
  (derived-state cleanup in PC purge; provenance insert trigger + USD price_native;
  sold_median→**sold_guide** rename; SnkrDunk stripped from daily-snapshot,
  historical-worker deleted as broken/fabricating), 1 documented (FK CASCADE exception).
- User approved: merge+push AND all three DB steps (purges + REVOKE), gated on scraper
  redeploy confirmation.
- Live dry-run numbers: snkrdunk 563 rows/463 cards + 357 cache rows; re-poisoned PC
  1,266 rows/766 cards (broader than review's ~124 — criterion is all wrong-product rows).
- NOTE for WP4+: price_kind enum value is `sold_guide` (NOT sold_median as plan said).

## Wave 0 DB + deploy: LANDED 2026-07-28 ~05:00 UTC

- Scrapers redeployed via Coolify API (user authorized API-driven deploys); new container
  confirmed writing from e6b5e91; snkrdunk writes frozen at 04:44 UTC.
- **Mystery writer identified**: the old scrapers container ran `el-newupdate`-branch code
  (no-onConflict upsert → duplicate appends; 24/7 snkrdunk ingester; numeric grades with
  grading_company_id → the 37 grade='10' rows). Review's open question closed.
- Migrations applied via MCP: purge_snkrdunk (563 rows), purge_repoisoned_pricecharting
  (1,266 rows + cache strip + ttl recompute), price_history_provenance (+ fill trigger),
  price_history_append_only (REVOKE). All verification checks green: 0 snkrdunk rows,
  0 poisoned PC rows, 0 NULL price_kind, trigger filling new rows.
- Expected residual: BASE-card PriceCharting mismatches remain (e.g. op-op08-021 $750.93
  vs TCGPlayer $0.20) — that is WP5/WP7 scope (identity assertion + mapping), untouched
  by the suffix purge by design.
- `el-newupdate` branch assessment: do NOT merge (pre-dates PC remediation). Salvage
  later: mapping-dictionary.json +1,776 entries (WP7a seed), validate-source-tunnels.ts +
  sources dashboard (WP7 ideas), Ollama vision variant-mapper (unverified).

## Incident 2026-07-28 ~05:08 UTC: Supabase wedged

- Postgres stopped emitting logs at 05:08 (last checkpoint took 222s); REST 522s from
  ~05:14; likely trigger: provenance migration's full-table rewrite + concurrent heavy
  analysis queries (+ scraper load) on the instance → OOM/disk wedge. User restarting
  project via dashboard. Coincides with a Supabase usage-cap email.
- Scrapers survived (old code logs-and-continues) but queue positions burn during outages
  (last_price_fetch advances before writes — fixed in WP4 rewrite ordering).
- WP4 hardened in response (`b638fb6`): transient-DB-error backoff in-process (5s→5min),
  exp_backoff_restart_delay in PM2 — without this, throw-on-error + max_restarts=50 would
  have permanently killed the fleet in ~4 min of outage.

## Expensive-cards investigation (luna panel + ground truth) — 2026-07-28

- DBFW top-2 ($17.7k E-42, $8.8k E-90) VERIFIED CORRECT products (manga-cover Energy
  Marker parallels on Cardrush); E-42 is a SOLD-OUT ask though.
- OP top entries largely 100x-inflated: yuyutei maps _p2/_p3/_p4 to one selector bucket,
  matched a sold-out Y798k serial promo to 3 different Zoros (real _p2: Y7,980). ~15
  sibling clusters >$100. USER APPROVED purge (migration written, PENDING DB recovery:
  purge_yuyutei_same_listing_clusters).
- 2,458/4,436 OP variants unpriced (structurally unpriceable until WP7 mapping).
- NEW WP5 requirement adopted: sold-out/stock check in yuyutei+cardrush evidence.

## Cost/usage (user got usage email)

- R2 image cutover NEVER COMPLETED (infra live since 07-22, "pending creds/deploy") —
  Supabase Storage egress still serving all card images; likely dominant meter.
  → luna worker on worktree `infra/r2-cutover` finishing the code side + ops checklist.
- Neon migration: recommended AGAINST for now (PostgREST/RLS/Storage coupling);
  re-evaluate after R2 cutover + WP8 write-churn reduction.

## WP4+WP5 combined sol review (2026-07-28): 8 findings, all accepted

P1: dbfw queue overlap with newly-registered en-dbfw (add %-ja); cached-anchor
self-validation in assertIdentity (title-only for cached paths); non-idempotent persist
retries (reorder writes + 15-min dup suppression); structural queue errors treated as
transient (split 3-way). P2: cache delete+insert wipes ebay_sales (carry over);
quarantined observations could corroborate (identity-valid only); quarantine table
lacks RLS (enable, no policies); scrape-once persists empty results (skip).
Luna fix worker dispatched with adjudicated instructions. WP5 self-consistency threshold
corrected 2x→8x (Fable; worker had over-tightened due to contradictory test spec).

## Waves 1–2 SHIPPED 2026-07-28 ~08:00 UTC

- WP4+WP5 merged to main (b56a8c0), price_quarantine applied (RLS on), scrapers deployed.
- Gate VERIFIED for the first time: all 5 boot lines `build=b56a8c0…` (SOURCE_COMMIT
  wiring), en-dbfw alive processing dash-suffix variants, zero 42P10 (upsert removed),
  identity layer quarantining from cycle one.
- First-cycle quarantine review found two fail-closed false positives, fixed same hour
  (2d11b87, merge dff0953): boundary matcher was whole-token (CJK-glued numbers like
  {FB03-078} never matched) → alphanumeric-lookaround; yuyutei evidence used h1 (never
  has the number) → append body number badge / prefer row text; 在庫:× sold-out added.
  Redeploy with fix in flight.
- WP6 APPLIED 2026-07-28 08:15Z with user approval (`0a19ad2`): 33 dup cards deduped,
  UNIQUE(card_id) live, repo 003 deleted, writes flowing through constraint.
  Post-fix quarantine stream verified healthy (1 righteous sold-out, 1 pre-fix-window
  artifact, 1 known PC-floor-vs-cheap-card case → future pair-specific bands in WP7).
- REMAINING: WP7a/7b (mapping + resolver/pricer split; seed from el-newupdate's
  +1,776-entry dictionary), WP8a/8b/8c (card_price_current, repoint readers, drop
  price_cache), R2 ops steps (user), 24h quarantine soak review.

## Wave 4 kickoff (2026-07-28 ~09:00 UTC)

- Pre-gates green: quarantine soak healthy (only known classes; post-fix yuyutei
  number-mismatches are P-promos whose row titles carry no number — righteous fail-closed,
  the exact class WP7 mapping fixes); scrapers writing from all 4 sources; running
  container = dff0953 (deployment record; 0a19ad2 delta is migration-file-only).
- Coolify token from kickoff message was dead; user supplied working token 93|XqJs…f035.
- WP7 interface freeze committed on `price/wp7-base` (4748f21): card_source_mapping +
  source_qualifiers DDL (applied to prod via MCP as `card_source_mapping`), mapping.ts
  (upsertMapping never downgrades confirmed without force), mapping.test.ts. 42/42 vitest.
- el-newupdate dictionary verified: 1,924 entries, exact superset of main's 150, 0 value
  conflicts. DECISION: do NOT touch runtime mapping-dictionary.json (tcgcsv live-reads it);
  expanded data staged as scripts/price-engine/mapping-dictionary-expanded.json in wp7a
  worktree, seed-only input (150 confirmed / 1,774 derived).
- Luna workers dispatched in parallel worktrees: wp7a (seed+resolver+ecosystem entry),
  wp7b (pricer split, by-anchor fetchers, title-drift guard, URL write-back removal).
  Gate order: A reviewed → seed dry-run shown → seed → resolver soak --limit 20 reviewed →
  A merges → B merges (only after soak) → deploy → boot-line + first-cycle verify.
- R2 track: infra/r2-cutover reviewed + built + merged to main (68a0193), pushed.
  Storage inventory: 15,024 objects / 3,067 MB, last write 07-22 (writers already quiet).
  R2 bucket already held 14,827 objects from earlier backfills → delta copy ~200 objects.
  Token-derived S3 creds WORK (access key = CF token id, secret = sha256(token)).
  Copy running via rclone HTTP→R2 (--files-from keys.txt from storage API listing,
  --no-traverse; Supabase public endpoint can't list dirs → 400 on readDir, expected).

## Wave 4 mid-flight (2026-07-28 ~11:00 UTC)

- WP7a landed (`price/wp7a-resolver` ca345de) + WP7b landed (`price/wp7b-pricer` cb08251,
  incl. Fable fix: PC PSA10 via label-exact 'PSA 10' cell on product pages — anchor path
  had lost the labeled grade10 search column). Integration branch `price/wp7-integration`
  (dfc7a4b) green: 57/57 vitest, tsc clean.
- SEED RAN: 11,247 mappings live (150 confirmed dict, 1,774→745 derived dict after
  cleanup, 2,923 product-id, 2,388 yuyutei, 3,322 cardrush, 1,772 snkrdunk; 0 orphaned;
  1,200 suspect URLs skipped).
- Sol reviews: WP7a 9 findings, WP7b 4 findings — all adjudicated into a 13-fix package
  (F1-F13, see scratchpad wp7-fix-prompt.md) running as luna worker on wt/wp7fix.
  Key adjudications: resolver gets RAW PC candidates (qualifier taxonomy was unreachable);
  drift check = normalized externalSet mismatch only (title containment too fragile across
  fetch paths); NULL-title seeds NOT failed closed — first accepted fetch backfills
  evidence; sold-out passes identity for mapping; cardrush routes to JA DBFW; candidates
  restricted to op-/dbfw-.
- DB CLEANUP (user approved): 1,086 poisoned rows deleted (1,029 -ja dictionary rows w/
  EN product ids + 53 base/variant product-id collisions + overlap).
- Resolver soak (tcgplayer --limit 20): exposed the Pokemon-candidate routing gap (F7);
  all NOMATCH, no bad writes, empty qualifier tally.
- R2: copy COMPLETE & verified (15,024/15,024 keys, 0 missing/extra, 2.995 GiB).
  Coolify web env vars were already correctly staged since 07-22 (NEXT_PUBLIC_IMAGE_CDN
  is_buildtime:true; R2 secret = sha256(cfut token), verified). BLOCKED on Cloudflare
  Image Transformations quota (ERROR 9422, free tier exhausted account-wide) — user chose
  to enable paid transforms in dashboard; deploy waits until the endpoint stops 429ing.
  Plain R2 serving already returns 200. DO NOT deploy the CDN flag while transforms 429.

## WP7 MERGED TO MAIN (2026-07-28 ~11:25 UTC)

- Fix package f172969 (13 fixes) verified: 66/66 vitest, tsc clean. Soak round 2:
  tcgplayer routing fixed (op-/dbfw- only, energy markers NOMATCH no-write), yuyutei
  variants refuse-to-guess NOMATCH no-write, PC local inconclusive (CF challenge; prod
  first-cycle review is the closing PC soak item). Pricer probe op-eb01-041: anchor-only
  fetch, unmapped source skipped, 'no search performed', dup suppression, evidence
  backfill confirmed in DB (title+set+verified_at now populated on the mapping).
- Merged to main 1b7140d (+e31d62b scratch cleanup), pushed. Scraper deploy queued
  (x17aj8fidsg8iv7vc10g9jx6) — verify boot build=e31d62b + first cycles.
- EXPECTED post-deploy: PriceCharting history rows PAUSE (no PC mappings seeded; the
  resolver builds them at ~20s/pair) — by design, refuse-to-guess generalized. tcgplayer
  (4,847), yuyutei (2,388), cardrush (3,322) keep pricing via seeded anchors.

## WAVE 4 DEPLOYED & VERIFIED (2026-07-28 11:25 UTC)

- All 4 workers boot `build=e31d62b`; resolver live in the same container.
- First cycles: anchored tcgplayer fetches writing (written=1), unmapped cards
  skip-with-advance, zero quarantines in first minutes.
- Resolver first prod accepts VERIFIED CORRECT: dbfw-e-01 → EN Energy Markers catalogue,
  dbfw-e-01-ja → JA Energy Markers catalogue — language/game discrimination working.
- REMAINING SOAK (next session): 24h review of RESOLVER-* logs (esp. unknown-qualifier
  tally + reject rate), quarantine stream, PC mapping coverage growth, coverage delta
  (cards priced/day vs pre-WP7). Then WP8a/8b/8c.
- R2 cutover: STILL blocked on Cloudflare Images purchase (no Images subscription on
  account; endpoint 429 ERROR 9422). Everything else ready: bucket copy verified
  15,024/15,024; env vars staged (build-time flag confirmed); deploy is one API call
  once transforms return 200. Zone-level image_resizing was already 'on' — the needed
  action is the ACCOUNT-level Images purchase (dashboard → Images → Transformations).

## R2 CUTOVER LIVE (2026-07-28 ~11:50 UTC)

- User purchased Cloudflare Images starter bundle (images_v2_stream_bundle_basic, Paid);
  transforms 200 (AVIF). Web deployed with NEXT_PUBLIC_IMAGE_CDN baked in.
- Verified serving: homepage / set (op-st-34) / card detail (4 CDN refs) / decks (24 CDN
  refs) all reference images.tcgmaster.com, zero supabase.co/storage in fresh renders;
  sampled object serves 200 image/png; transform endpoint 200 image/avif.
- Supabase Storage objects NOT deleted (rollback path). Stale ISR pages revalidate on
  their own cadence. NEXT: user watches Supabase egress fall over coming days; storage
  cleanup only after a healthy window.

## Wave 5: WP8a SHIPPED (2026-07-28 ~12:20 UTC)

- Wave-4 soak review PASSED first: resolver 10 ACCEPT/0 REJECT/0 unknown-qualifier, all 11
  PC mappings spot-checked correct (EN/JA catalogue discrimination, URLs present);
  quarantine clean (4 yuyutei number-mismatch + 1 sold-out, zero title-drift); PC paused
  as designed, resolver ~39 mappings/hr (full PC re-coverage ~1-2 weeks — background).
  PC PSA10 label-parse still unproven (only Energy Markers mapped) — WATCH ITEM.
- WP8a merged to main e3db00a (branch price/wp8a-current 601da02+7308294), scrapers
  deployed & boot-verified build=e3db00a, live writes + 1 righteous quarantine confirmed.
- Sol review 3 findings: F1 render-time TTL writer → deferred to WP8b deletion (planned);
  F2 partial-scrape/cross-worker clobber → FIXED: card_price_current upsert now MERGES
  per-source (fresh wins) + graded per-grade-source with recomputed average; headline
  recomputed from MERGED state via new selectHeadlineFromSourcePrices; F3 publish order →
  FIXED: projection upsert moved after price_history insert. 75/75 vitest.
- Migration 20260728180000_card_price_current applied via MCP (PK card_id, trigger
  mirror_headline_to_ttl → cards.price_cache_ttl, RLS read-only). Backfill: 10,748 rows
  (= all priced cards), 100% non-null headline; graded_prices empty everywhere because
  price_history has ZERO graded rows (verified — not a bug).
- Live probe op-eb01-041: merge proven (fresh tcgplayer + preserved backfilled
  pricecharting entry), ttl trigger-mirrored.
- database.types.ts: full MCP regen has schema-wide nullability drift breaking unrelated
  files — spliced ONLY the card_price_current block into wp8b's copy (44 lines).
- WP8b luna worker in wt/wp8b off price/wp8a-current: repoint all readers (incl.
  api/cards/[id] + ppt/service reads found beyond plan), delete render-time TTL write,
  null PPT condition multipliers, deregister syncPrices/syncSetPrices.

## Wave 5 COMPLETE: WP8b + WP8c SHIPPED (2026-07-28 ~14:15 UTC) — OVERHAUL DONE

- WP8b merged 113ce2b, deployed web+scrapers, boot-verified. Sol review 4 findings:
  F1 (keep syncPrices as "only Pokemon publisher") REJECTED — syncPrices never
  successfully wrote a row (42P10, review §0); request-time PPT fallback intact. F2-F4
  FIXED: fallback gates on "no usable price" not row-existence; /api/cards raw stays
  numeric source-keyed + new sourcePrices field; freshness from max
  source_prices[*].recorded_at (helper latestRecordedAt), not computed_at.
  75/75 vitest, tsc clean, next build OK, 84/84 Playwright e2e.
- Live page verify: kind labels rendering (Crocus "Market $0.05", Golden Frieza
  "Sold guide $3.18" = DB values), zero "Near Mint" fabrication.
- WP8c 27bef70: compat write + shapeRawPrices deleted from write-path; admin/health
  count repointed (drop would have broken it at runtime); scrape-once prints
  currentPrice. Deployed BOTH apps, boot=27bef70 verified, THEN (user approved)
  DROP TABLE price_cache applied (8,283 rows). Post-drop: 12 projection writes/3min,
  19 history rows/5min, 0 errors, pages 200.
- Worktrees wp8a/wp8b removed, branches deleted. Migrations in repo:
  20260728180000_card_price_current, 20260728190000_drop_price_cache.
- Follow-ups now open: delete dead price_cache scripts + inngest/functions/sync-prices.ts
  scrape-prices.ts bodies (unregistered, reference dropped table if ever run);
  database.types.ts full regen (deferred: schema-wide nullability drift breaks
  app/collection + app/page — needs its own pass); PC PSA10 label-parse watch;
  Supabase Storage decommission after healthy R2 window; Pokemon has NO scheduled price
  publisher (unchanged de-facto, now explicit); CF token rotation.

## Post-overhaul follow-up sweep (2026-07-28 ~14:30 UTC session)

- **Soak (task 4) PASSED**: scrapers healthy all 4 sources, card_price_current
  10,748/10,748 fresh. Resolver NOT stalled — 56 PC mappings by 12:50Z (~54/hr), then a
  NOMATCH desert over `dbfw-e-*` cards PC doesn't list (advancing e-05→e-121, no loop).
  All 56 mappings DBFW; PSA10=0 is benign (no OP cards PC-mapped yet) — watch stays open.
- STALE NOTE FIX: purge_yuyutei_same_listing_clusters WAS applied (earlier "pending DB
  recovery" note obsolete).
- New known-healthy quarantine class: **cardrush number-mismatch on `_p1` parallels**
  (row titles carry base number only) — same righteous fail-closed family as yuyutei
  P-promos. PC ratio-vs-median rows in 24h window were all pre-WP7-deploy (moot).
- **FINDING REVERSED on investigation: tcgplayer ratio-vs-median quarantines were
  RIGHTEOUS** — the band was blocking WRONG-ANCHOR fetches, not stale medians. The
  expanded (el-newupdate) dictionary seeded base cards with sibling-variant/adjacent
  product ids (op-op09-061 base got the _p2 alt-art's 632776; op-op10-032 617069→617070;
  op-op09-022 596946→596947). History from curated cards.tcg_player_id was sane and
  internally consistent. DB-wide: 216 tcgplayer mappings disagreed with the curated
  column (173 derived-dict unverified + 43 confirmed-dict unverified); the non-quarantined
  ones were silently writing wrong-product prices (only 8x+ gaps trip the band).
- **FIX APPLIED (user approved 2026-07-28)**: the 173 derived mismatches UPDATEd back to
  cards.tcg_player_id (evidence jsonb carries resetFrom/resetReason audit). No history
  deleted. Remaining 43 confirmed-dict mismatches left for a future verification pass.
  WATCH: op-op07-022 Otama quarantined at 15x with an AGREEING anchor — possible
  printing-selection (normal vs foil) drift in the by-anchor tcgplayer fetcher; observe
  whether more same-anchor jumps appear before touching the fetcher.
- **Task 1+3 dead-code sweep MERGED to main `60f7878`** (−1,782 LOC): deleted
  sync-prices/scrape-prices Inngest fns + 13 dead price_cache scripts + residual direct
  price_history writers (daily-snapshot.ts — EN tcgcsv snapshots already covered by queue
  workers via shared write path; test-insert.ts). All remaining price_history access
  outside lib/price-engine is read-only. 75/75 vitest, tsc = pre-existing admin/health only.
- **Task 2 types regen MERGED to main `77ac099`** (pushed): full MCP regen (2,200
  ins/931 del) replacing the hand-aged file; card_price_current block verified
  semantically identical (enum ref = same 5-member union). Regen EXPOSED 3 latent
  runtime bugs, all fixed: (a) app/sitemap.ts selected nonexistent sets.updated_at →
  set pages were silently missing from the sitemap (PostgREST 400 → data null); now
  created_at; (b) fetch-images/images-service selected nonexistent cards.poke_tcg_id
  and image_fetch_attempts → Pokemon image queries 400'd; (c) psa.ts
  `grading_companies!inner` embed ambiguous (cert_history has 2 FKs to
  grading_companies) → disambiguated via cert_history_grading_company_id_fkey. Regen
  also FIXED the old admin/health never-type errors → **tsc is now FULLY clean**
  (pre-existing-exception list is empty). Luna worker implemented; sol-xhigh review
  3 findings (P1 wrong-artwork via name-only lookup, P2 SET_ID_MAP dead-ends, P2
  unbounded retry) adjudicated: automated Pokemon image-fetch crons DISABLED with
  explicit early-return (pipeline never worked — columns never existed; all 92 Pokemon
  cards already have local images; manual events remain). 75/75 vitest, next build
  green.
- **DEPLOY 77ac099 VERIFIED on all THREE apps** (web, scrapers, inngest): first
  concurrent web+scrapers deploy pair BOTH failed ~41s in (exit 255 mid-npm-install,
  build-server contention) — SERIAL deploys succeeded. Scrapers: all 4 workers boot
  build=77ac099, written=1 from first cycle. Web live checks: home 200, card page
  kind-labeled prices + CDN images, **sitemap now carries 98 set pages (was 0 —
  sets.updated_at bug fixed in prod)**. tcgmaster-inngest also being deployed since
  the fetch-images cron disable lives there (memory updated: inngest/functions
  changes need the third app deployed).
- **Mapping-reset validation**: op-op01-109 (reset card) wrote an accepted tcgplayer
  row at 14:39Z, minutes after the fix — corrected anchors flowing.

## Task 5: Supabase Storage `card-images` DECOMMISSIONED (2026-07-29)

- User chose to proceed on a <1-day soak window (kickoff wanted several days; user
  attested Supabase dashboard egress ~zero since cutover and Cloudflare analytics
  carrying image traffic) and gave explicit deletion approval via AskUserQuestion.
- Preconditions all PASSED before deletion:
  - Inventory: SQL count exactly **15,024 objects / 3,067 MB** (3,216,012,735 B), newest
    object 2026-07-22 → nothing written after the R2 copy; Storage-API recursive list
    independently matched 15,024 (cards/ 313, dbfw/ 5,378, one-piece/ 9,333). No delta
    sync needed.
  - CDN probes: plain R2 objects 200 (image/webp + image/png), transform endpoint 200
    image/avif, no 429/9422.
  - Fresh renders: /decks, set op-st-34, card op-st34-001-ja = 0 supabase.co/storage
    refs, CDN refs present. Home had 6 supabase URLs but ALL inside serialized RSC JSON
    (`image_url` DB values for DBFW cards), none in src/srcset/preload/meta; every
    image_url consumer (cards-marquee, card-grid-item, card-preview/CardImage,
    search-bar via cdnImageUrl) routes through cloudflareImageLoader host-swap →
    browsers never fetch Supabase. This is expected steady-state, not stale ISR.
  - Code writers: storeCardImage prefers R2 (R2_* present), fetch-images crons
    hard-disabled (77ac099), only manual seed/backfill scripts remain,
    cleanupOrphanedImages has zero callers.
- Deletion 2026-07-29 (~04:0xZ): batched Storage-API DELETE (100 keys/call) via
  scratchpad script — **15,024 deleted, 0 failed**. Bucket kept (row still in
  storage.buckets), objects_left = 0.
- Post-verify: home/decks/set/card all 200; R2 object 200 image/png; transform 200
  image/avif; Sentry (amir-ariff): zero new issues firstSeen 2026-07-29.
- **R2 is now the SOLE copy of the 15,024 card images.** Rollback to Supabase-served
  would require re-copy FROM R2 (rclone --files-from) + drop NEXT_PUBLIC_IMAGE_CDN
  build var + web redeploy. No rclone config on this machine (cutover used env-var
  config or another env).
- Token hygiene: user reports rotation PARTIALLY/NOT done (CF token from July
  transcripts + Coolify token from 07-28 sessions) — STILL OPEN.

## In flight

- WP5 (identity + quarantine + sold-out): luna worker in wt/wp5 off `price/wp4-write-path`.
- R2 cutover completion: luna worker in wt/r2 off main.
- WP4 sol-xhigh review: still running (its own MCP calls hit the dead DB; will conclude).
- DB recovery poll running; on recovery: apply yuyutei purge, verify integrity, confirm
  scrapers resume, then merge WP4 (pending sol review reconcile).

## Gates / user pauses outstanding

1. WP6 dedupe+unique — apply only after WP4+WP5 deployed & BUILD_SHA-verified.
2. WP8c drop price_cache — last.
3. R2 cutover env vars in Coolify — user action once checklist ready.
3. Apply WP6 dedupe+unique — after wave-2 deploy verified via boot BUILD_SHA log.
4. Apply WP8c drop price_cache — last, after web+scrapers+Inngest all verified current.

## Decisions log

- 2026-07-28: scope = full review §5 steps 1–8; luna implements in worktrees; DB via MCP
  with pause before destructive steps (user, via AskUserQuestion).
- Migration naming: timestamp convention; WP1=20260728100000/100100, WP3=20260728110000/110100.
- node_modules symlinked into worktrees for tsc/eslint.
