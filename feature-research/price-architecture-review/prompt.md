# Prompt — price-sourcing architecture review

Paste everything below the line into a fresh Claude Code session in
`/Users/amirariff/projects/tcgmaster`.

---

I want an architectural review of how this project sources, maps, and stores card price
data across multiple third-party platforms. Not a bug hunt — a design review of the layer
as a whole. Read the code and query the database before forming a view.

## What the system is

TCGMaster is a Next.js 16 price-comparison site for trading cards (One Piece TCG, Dragon
Ball Fusion World), ~15,342 cards. Three Coolify apps run from this one repo: the web app,
a scraper container (`Dockerfile.scraper`, PM2 via `ecosystem.config.cjs`), and a
self-hosted Inngest server (`Dockerfile.inngest`) that drives the web app's
`/api/inngest` endpoint on a cron.

## Grounding facts — verified, do not spend tokens re-deriving

**Price writers.** Four PM2 workers (`scripts/price-engine/queue-*.ts`: english-op, jp-op,
dbfw, english-dbfw — the last is not in `ecosystem.config.cjs`), plus two Inngest functions
(`inngest/functions/sync-prices.ts`: `syncPrices` on `0 */4 * * *`, `syncSetPrices` on an
event). They share no abstraction — each worker duplicates its own client, sleep logic,
price-reshaping block, upsert and history insert. Note `inngest/functions/scrape-prices.ts`
exists but is **not registered** in `app/api/inngest/route.ts` and never runs; do not read
it as live behaviour.

**Source fetchers** in `lib/price-engine/`: `tcgcsv.ts` (TCGPlayer), `pricecharting.ts`
(Puppeteer + stealth), `yuyutei.ts`, `snkrdunk.ts`, `cardrush.ts`, plus `lib/ppt/`
(PokemonPriceTracker API) used only as a page-render fallback. `tcgrepublic.ts` is imported
by nothing.

**Three separate price stores, different shapes and lifecycles:**
- `price_history` — append-only `(card_id, source, grade, price, recorded_at)`. The card
  page's headline `featuredPrice` comes from the newest row here
  (`app/[game]/[set]/[card]/page.tsx:350-368`).
- `price_cache` — one row per card, `raw_prices`/`graded_prices` JSONB. **Two incompatible
  schemas in the same column**: scrapers key by source name plus a computed `market` (min of
  the others), while `sync-prices.ts` keys by condition (`nearMint`/`lightlyPlayed`/…).
- `cards.price_cache_ttl` — integer *cents* (the name is a lie; not a TTL). **Dual-written
  with conflicting semantics**: scrapers write the lowest raw price, the page's own render
  writes a graded-preferred price (`page.tsx:359-370`). It is what `RelatedCards` displays
  and sorts by, and what search ranks on.

**Known-broken, deliberately left for this review:**
- `price_cache` upserts fail **100%** with Postgres `42P10`. The table has a unique index on
  `(card_id, variant_id)` only; every scraper upsert uses `onConflict: 'card_id'`. Migration
  `supabase/migrations/003_fix_price_cache_uniqueness.sql` was written to add that constraint
  and **was never applied**. Measured: 299 `price_history` writes/hour vs 2 `price_cache`
  writes/hour. This failed silently for a long time because the workers discarded the error.
  Fixing it needs a dedupe first (8,037 rows vs 8,001 distinct cards — NULL `variant_id`
  values don't collide under the current index).
- Set pages read `raw?.nearMint` (`app/[game]/[set]/page.tsx:83`), and **0 of 8,037**
  `price_cache` rows have that key — so set-page raw prices are blank sitewide. Game pages
  read `raw_prices->market` and do work.
- `cards.price_cache_ttl` still holds values derived from the mispricing described below.

**Card identity.** `cards.slug` is unique per set, `sets.slug` per game; the URL is
`/{game}/{set}/{card}`. `cards.number` carries variant suffixes in **two conventions** —
One Piece `OP05-119_p4`, Dragon Ball `E01-08-p1` (919 cards) — and slugs carry `-ja` for
Japanese printings. The same logical card exists many times across sets and languages.

**The mapping problem — the heart of it.** Our variant taxonomy (`_p3`, `_p4`, `_r1`)
corresponds to nothing any source uses. PriceCharting names the same printings `[SP Gold]`,
`[SP Silver]`, `[Alternate Art]`, `[Manga PRB01]`, `[Wanted]`, `[2nd Anniversary]`. A single
number, `OP05-119`, has **21 printings listed there between $4.70 and $10,545.17**, all
titled "… OP05-119". TCGPlayer resolved this with a hand-curated
`lib/price-engine/mapping-dictionary.json` (150 slug → product-id entries) and a comment at
`tcgcsv.ts:49` stating variants must rely strictly on it. PriceCharting had no such mapping
and guessed by keyword, which mispriced ~2,000 cards — 54 distinct cards shared one
$2,466.67, three unrelated "-119" cards shared $10,545.17, and a $0.24 card displayed as
$127.65.

**Remediation already shipped** (merged to main, deployed and verified in production):
`pricecharting.ts` now requires the result title to name the number **token-wise** (substring
matching let `E-01` match `E01-09`), accepts only the unqualified printing for base cards,
declines variants outright under both suffix conventions, and parses the product page when a
search redirects. Poisoned data was deleted: 4,556 `price_history` rows, 67 `price_cache`
rows, 253 recomputed `market` values. Post-deploy PriceCharting prices agree with other
sources within 1.4×–9.3× on sub-$2 cards, versus 924×–55,555× before.

**Two matching questions that remediation deliberately did NOT answer** — they need design,
not another patch, and they are the clearest live instances of the mapping problem:
1. Some Dragon Ball base cards are titled `Krillin [Holo] FB01-008`. The "no bracketed
   qualifier = base card" rule rejects them, losing legitimate coverage. A "unique match wins
   regardless of qualifier" rule would recover it — is that safe?
2. The two unqualified `OP05-119` rows ($13.71 and $11.00) are the **English and Japanese**
   printings, distinguished only by the set column and the product URL — both of which the
   scraper ignores entirely. Japanese callers pass `"<number> japanese"` as the search query
   but nothing verifies the row that comes back is the Japanese one.

## What I want you to work out

1. **Is the three-store design right?** `price_history`, `price_cache`, and
   `price_cache_ttl` overlap, disagree, and are written by different actors with different
   meanings. What is each actually for, which are load-bearing, and what would a coherent
   design look like?

2. **How should cross-platform identity be modelled?** Every source has its own taxonomy for
   printings, languages, and grades. Today that mapping is implicit, scattered across
   per-fetcher heuristics, and demonstrably wrong. Should there be an explicit
   identity/mapping layer — what owns it, how does it get populated, and how does a card with
   no confident mapping behave?

3. **What conventions differ per platform, and where do they leak?** Currency (Yuyutei/
   SnkrDunk/Cardrush appear to be JPY-denominated and converted — where, at what rate, and is
   it applied consistently?), grade vocabularies (`psa10` vs `grade10_price` vs eBay's
   `salesByGrade`), condition tiers, language editions, and "market" vs "ungraded" vs "lowest
   listing". PriceCharting quotes USD marketplace prices while Yuyutei quotes JPY Japanese
   retail, yet the card page presents them side by side as interchangeable. Which
   normalisations exist, which are assumed, and which are silently wrong?

4. **Where else can a wrong value reach the page?** The PriceCharting failure was one fetcher
   with no verification of what it matched. Apply that lens to every source and say which
   others can attach a plausible-looking price to the wrong card, and what a general guard
   would look like.

5. **What should change, in what order.** Distinguish what is structurally wrong from what is
   merely untidy, and say what you would leave alone.

## How to work

Read the actual code and query the live database (Supabase MCP is configured; project id
`mquqwlxqrsvfflsgfhmi`) to ground every claim in real data rather than inference. Where you
assert a convention or a defect, cite the file:line or the query result.

Do not change any code or data in this session — I want the analysis first, and I will decide
what to act on.

Delegate to a subagent only for genuinely wide, independent sweeps (for example, reading all
six source fetchers in parallel to compare their conventions). Do not delegate work you can
finish in a few tool calls, and keep spawn counts low.

## Deliverable

A single markdown document at `docs/price-architecture-review.md`, structured around the five
questions above. Lead with what you found that I would not already know from the facts above.

Match its length to the substance — cover the real findings and skip filler, restatement of
the grounding facts, and boilerplate summary sections. Concrete recommendations naming files
beat general principles. Where you are uncertain, say so and say what evidence would settle
it.
