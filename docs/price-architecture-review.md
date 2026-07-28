# Price layer: architecture review

Scope: how prices are sourced, matched to cards, normalised and stored. Read against the
working tree at `d89f93b` and the live database (`mquqwlxqrsvfflsgfhmi`) on 2026-07-28.
Every claim below is a `file:line` or a query result.

Findings were cross-checked by three independent reviewers reading the same tree without
access to the database. Where they disagreed with a conclusion and were right, the text below
is the corrected version — notably the PriceCharting floor mechanism (§0), the scope of the
`market` aggregate (§1), the mutability of `price_history` (§1), and the fourth exchange rate
(§3). Claims resting on database evidence they could not see are marked as such.

---

## 0. What I found that contradicts the brief

Three of the grounding facts are wrong in ways that change the fix.

**`price_cache` never held two schemas.** Across all 8,040 rows the only `raw_prices` keys
that exist are source-keyed: `market` 8,033, `yuyutei` 1,622, `tcgplayer` 1,264,
`cardrush` 1,104, `pricecharting` 440, `snkrdunk` 357. There is no `nearMint`, no
`lightlyPlayed`, and there never has been. The condition-keyed writer in
`inngest/functions/sync-prices.ts:180-193` has **never successfully written a row**. So the
set page reading `raw?.nearMint` (`app/[game]/[set]/page.tsx:83`) is not two writers
disagreeing — it is a read of a key no writer has ever produced.

**Both upsert paths are broken, in opposite directions.** The 42P10 is confirmed
empirically — `EXPLAIN INSERT … ON CONFLICT (card_id)` against the live table returns
*"there is no unique or exclusion constraint matching the ON CONFLICT specification"*. But
the fallback at `sync-prices.ts:97-112` and `lib/ppt/service.ts:182-191` **cannot fire for
the error it was written to handle**: supabase-js resolves with `{ error }` rather than
throwing, so a PostgREST 42P10 never reaches `catch`. It is not quite dead code — a
transport-level exception would enter it — which makes it worse than inert, because
`variant_id` is NULL on all 8,040 rows and
`price_cache_card_id_variant_id_key` is NULLS DISTINCT, so `onConflict: 'card_id,variant_id'`
never conflicts and every write **appends a duplicate row**. The table already holds 8,040
rows for 8,006 cards.

That duplication is not cosmetic. Four readers use `.single()` — `lib/pricing/portfolio.ts:248`,
`lib/pricing/alerts.ts:126` and `:246`, `app/api/collections/[id]/items/route.ts:102` — and
`.single()` **errors** when two rows match. Portfolio valuation, price alerts and
collection cost-basis are already failing for the duplicated cards. The card and set pages
instead take `price_cache[0]` (`app/[game]/[set]/[card]/page.tsx:312-314`,
`app/[game]/[set]/page.tsx:67`) with no `order by`, so they render an arbitrary row —
`op-eb04-025-ja` currently has one row with `{market, yuyutei}` and another with
`{market, yuyutei, snkrdunk, pricecharting}`, and which one you see is up to Postgres.
`app/api/collections/[id]/items/from-cert/route.ts:208` is the only reader that does it
correctly (`order by fetched_at desc limit 1`).

**The PriceCharting remediation is live, but it fixed the smaller half of the problem.**
The variant guard cut over cleanly and visibly: PriceCharting rows against suffixed card
numbers ran 13–53 per hour all through 2026-07-26 and the morning of 07-27, then went to
**0 at 09:00 UTC on 2026-07-27 and have stayed at 0**. That is real and it holds.

What did not get fixed is base-card matching. Of 1,895 cards where TCGPlayer and
PriceCharting both have a current price, **325 disagree by more than 10×, and 201 of those
were scraped after the cutover** — 8 of them by more than 100×. `op-op08-021` is TCGPlayer
$0.20 against PriceCharting $750.93. The inverse direction exists too: `op-p-099` is
TCGPlayer $99.48 against PriceCharting $0.31, `op-prb02-006` is $878.97 against $9.99.
Separately, the poison purge ran *before* the deploy, so ~124 cards re-poisoned in the gap
still carry a >10× row as their newest `price_history` entry — which is exactly what feeds
`featuredPrice` and `price_cache_ttl`.

**One caveat on that 10× number, and it matters for the fix.** Most of the 201 are not
mis-matches. They cluster hard at PriceCharting $0.99–$1.50 against TCGPlayer $0.04–$0.15
(`op-op03-005` $0.05/$1.50, `op-op07-011` $0.04/$0.99, and dozens more at exactly $1.50).
PriceCharting quotes a sold-data guide value with an effective floor near $1 on bulk
commons; TCGPlayer quotes a sales-derived market price that goes to $0.04. The gap is a
semantic difference, not a wrong card. (I originally attributed the floor to
shipping-inclusive pricing; PriceCharting's published methodology says shipping is
*excluded*, so the floor is real in the data but its cause is not established.) A naive
"flag >10×" guard would fire mostly on correct data. The signal is in the extreme tail and
in the inverted cases.

### And one finding that is worse than anything in the brief

**SnkrDunk is systematically pricing the wrong thing, and it has gone unnoticed because it
is the smallest source.** Of 343 cards where SnkrDunk and Yuyutei both have a current
price, the **median ratio is 31.3×** and **319 of 343 disagree by more than 5×**. SnkrDunk's
minimum observed price across all of `price_history` is **$7.00**; Yuyutei's is $0.17.
A source that never returns a sub-$7 price for a catalogue full of ¥30 commons is not
pricing those commons.

The cause is in the code: `lib/price-engine/snkrdunk.ts` **never checks that the result is
the card we asked for**. The loop at `:88-135` filters purely on printing keywords
(`parallel`, `manga`, `sp`, `gold`) and language tags, then takes the first survivor —
whatever card it belongs to. There is no equivalent of `pricecharting.ts:122` or
`tcgcsv.ts:40-43`. `lib/price-engine/yuyutei.ts:75-127` has the same hole.

---

## 1. Is the three-store design right?

No — but the problem is not that there are three stores. It is that one of them holds
facts, one holds an aggregate that means nothing, and one is a denormalised copy with a
name that lies, and the system reads the wrong one on every surface.

**What each is actually for, measured:**

| store | writes/hour | who reads it | status |
|---|---|---|---|
| `price_history` | ~250–350 | card page headline + chart + "Compared Markets" | load-bearing, healthy |
| `price_cache` | ~1–3 | set page (broken), game page, trending, portfolio, alerts, collections | near-inert |
| `cards.price_cache_ttl` | every scrape + every card render | `RelatedCards`, search ranking, search sort | load-bearing, contested |

`price_history` is the only store working roughly as designed. It records
`(card_id, source, grade, price, recorded_at)` and `page.tsx:361-368` derives the headline
price from its newest row. Keep the shape.

But it is **append-only by convention, not by construction**, and the convention has been
broken. `scripts/rearrange-price-history.ts:105` and `-v2.ts:110` issue
`UPDATE price_history SET card_id = …`, reattributing historical observations to a
*different card*; `:140` deletes rows below a price threshold; `purge-duplicate-prices.ts:56`
and `purge-variant-mappings.ts:66` delete more. The writer set is also wider than the four
workers and two Inngest functions — `scripts/daily-snapshot.ts`, `historical-worker.ts`,
`scrape-one.ts` and `seed-cardrush.ts` all append to it directly.

This matters beyond tidiness. A fact table that gets hand-edited is not a reliable base for
the derived store proposed below, and it is the same table this review's own forensics rest
on — the cutover timeline in §0 and every ratio in §3 and §4 assume rows mean what they say.
Make it genuinely append-only (revoke `UPDATE`/`DELETE`, add corrections as compensating
rows) before building anything on top of it.

`price_cache` is almost dead and what remains is misleading. 7,908 of 8,040 rows have empty
`graded_prices`; 7,167 are past `expires_at`; the last meaningful write burst was 2026-07-26.
Every surface reading it is either broken or reading an aggregate:

- Set pages read `raw?.nearMint` — **0 rows have that key**, so raw prices are blank sitewide.
- Game pages (`app/[game]/page.tsx:108,152,172`) and trending
  (`app/api/cron/trending/route.ts:57`) read `raw_prices->market`, which works but see below.
- The card page reads `raw_prices.nearMint ?? raw_prices.market` (`page.tsx:331`) — so when
  `nearMint` is absent, which is always, **it displays the `market` aggregate in the "Near
  Mint" slot**. That is a silent semantic substitution on a user-visible label.

And `market` is not a market price. Each worker computes it as
`Math.min(...Object.values(cacheRawPrices))` (`queue-english-op.ts:119`, `queue-jp-op.ts:125`,
`queue-dbfw.ts:108`, `queue-english-dbfw.ts:120`) — the minimum across whichever sources
that particular worker happened to fetch successfully. No card ever compares all five: the
English OP worker sees TCGPlayer and PriceCharting, the Japanese OP worker sees Yuyutei,
SnkrDunk and PriceCharting, the DBFW worker sees Cardrush and PriceCharting. So `market` is
the minimum of two or three quantities that are not the same kind of number, and *which*
quantities depends on the worker and on which fetches happened to succeed that run — a card
whose SnkrDunk fetch fails gets a different `market` definition than one whose succeeds.
It is what game pages sort by and what trending ranks on.

`graded_prices` is broken in a second, independent way. Scrapers write
`cacheGradedPrices[grade][source] = price` (`queue-jp-op.ts:118-120`), producing
`{"psa10": {"snkrdunk": 85}}` — a **number**. The page reads `gradedPrices.psa10?.average`
(`page.tsx:361`, `:412`), which on a number is `undefined`. **Every graded price a scraper
has ever written is unreadable by the page.** Only the PPT shape
`{psa10: {average, median, low, high, count}}` (`sync-prices.ts:70-95`) can be read — and
that writer never lands a row. There is also a third key spelling in the data, `psa-10`.

`cards.price_cache_ttl` is the one that is genuinely load-bearing and genuinely contested.
It holds cents (min 1, max 1,770,701 = $17,707.01), and it backs `RelatedCards`
(`components/card/related-cards.tsx:46`), search ranking and both sort directions
(`lib/search/service.ts:192-203`, `:289`). It is written by every scraper as
`min(raw prices) × 100` and *also* by the card page's own render as a graded-preferred
featured price (`page.tsx:370-381`) — a fire-and-forget write issued during rendering. The
cost of that dual write is measurable: **3,136 of 11,074 cards (28.3%) have a
`price_cache_ttl` that disagrees with the newest raw `price_history` price for the same
card.** Whichever actor touched the card last wins, and one of those actors is page traffic,
so the value depends on who browsed what.

The render-time write is also wrong on its own terms. It fires from a server component
under `revalidate = 86400`, it is not awaited, its error is only logged, and two concurrent
renders of the same card can write different values (the scraper's min-of-raw versus the
page's graded-preferred). It is a cache write disguised as a page render.

`lib/ppt/service.ts:219` still sets `price_cache_ttl: 3600` — the original seconds-TTL
meaning. No row in the database holds 3600, so the cents reading is the only live one, but
the column name, the generated type (`lib/supabase/database.types.ts:160`) and that line
all still assert otherwise.

### Target design

Two stores, not three.

1. **`price_history` stays as the fact table**, with three columns added: `currency`
   (the currency the source actually quoted), `price_native` (before conversion), and
   `price_kind` (`market` | `lowest_listing` | `retail_sell` | `sold_median`). Today all five
   sources write a bare USD number into one column and the meaning is lost at the point of
   write. Backfill is mechanical — source determines kind.

2. **`card_price_current` replaces `price_cache`**: one row per card, `PRIMARY KEY (card_id)`
   — not a unique index over a nullable column — holding the per-source current prices, an
   explicitly chosen headline price, and the `price_kind`/`currency`/`source` that headline
   came from. Derived from `price_history` by the writer, or as a materialised view refreshed
   on write. The point is that the headline price becomes a *decision that is recorded*
   rather than a `Math.min` computed independently in four files.

3. **`cards.price_cache_ttl` becomes a read-only mirror** of `card_price_current.headline_cents`,
   maintained by trigger, kept only because search ranks and sorts on it and pushing a join
   into `lib/search/service.ts` is a larger change than this review should force. Delete the
   render-time write at `page.tsx:370-381` outright. Rename the column when convenient; it is
   the least urgent thing here.

**Migration order that is safe:**

1. Dedupe `price_cache` (34 cards, keep newest by `fetched_at`) — migration
   `003_fix_price_cache_uniqueness.sql` already contains exactly this and has **never been
   applied** (`list_migrations` shows `001`, `006`–`011`, `add_scraper_price_sources`; no `003`).
2. Apply the unique constraint from `003`. This alone makes every scraper upsert start
   working — which means step 3 must land first or you will simply begin writing the
   `market` aggregate more efficiently.
3. Fix the writers (single shared module, see §5) and the `graded_prices` shape.
4. Introduce `card_price_current`, repoint the six readers, drop `price_cache`.

Do **not** apply `003` on its own as a quick win. Right now the broken upsert is the only
thing preventing 300 wrong `market` values an hour from reaching the game pages.

---

## 2. How should cross-platform identity be modelled?

The root cause of every mispricing in this system is that **resolution and pricing are the
same operation**. Every fetch re-answers "which product is this card?" from scratch, by
fuzzy search, on a schedule, with no memory and no verification. A search ranking change at
PriceCharting or SnkrDunk becomes a price change on our pages. That is the actual design
defect; the keyword heuristics are a symptom.

Today identity is handled five different ways:

| source | identity anchor | verification on search path | verification on cached path | risk |
|---|---|---|---|---|
| TCGPlayer | `cards.tcg_player_id` + `mapping-dictionary.json` (150 entries) | `extendedData.Number` equality (`tcgcsv.ts:40-43`) | **none** (`tcgcsv.ts:89-113`) | low-medium |
| Cardrush | `cards.cardrush_url` | `{BASENUMBER}` in title (`cardrush.ts:75`) | **none** (`cardrush.ts:17-27`) | medium |
| PriceCharting | **none** | number token in title (`pricecharting.ts:122`) | n/a — always re-searches | medium |
| Yuyutei | `cards.yuyutei_url` | **none** (`yuyutei.ts:75-127`) | **none** (`yuyutei.ts:21-39`) | high |
| SnkrDunk | `cards.snkrdunk_url` | **none** (`snkrdunk.ts:88-135`) | **none** (`snkrdunk.ts:20-53`) | high |

That fourth column is the point, and it is easy to miss: **not one source re-verifies
identity once it has a cached anchor.** Cardrush's `{BASENUMBER}` guard — the only reason to
trust it — applies solely on first resolution. And TCGPlayer, the source I would otherwise
call sound, prices a stored `tcg_player_id` or dictionary entry by ID without ever
re-checking `extendedData.Number` (`tcgcsv.ts:89-113`), so a wrong or stale ID is permanent
and invisible. Verification today is a property of *discovery*, not of *pricing* — which is
the §2 thesis in miniature.

There is also a uniqueness trap in TCGPlayer that mirrors the PriceCharting one below:
`tcgcsv.ts:46` returns immediately when exactly one product carries the number
(`matchedNumber.length === 1 && !suffix`), **before** the qualifier filter at `:59`. If the
only product for that number is an Alternate Art, a base card silently takes the alt-art
price. TCGPlayer fails closed on variants, but not on this.

Both ends of that table are wrong in instructive ways.

**PriceCharting has no persisted identity at all.** It re-searches on every run and re-derives
the match from the title. The token check makes that safer than it was, but it still cannot
distinguish two rows that both legitimately name the number — which is precisely the
English/Japanese case below.

**The URL-caching sources have the opposite failure: a wrong match becomes permanent.**
`queue-jp-op.ts:57` passes `card.yuyutei_url || card.number`, and `yuyutei.ts:21-39` fetches
that URL and parses a price with no check that the page is the right card. The URL is
written back to `cards.yuyutei_url` from whatever the keyword loop picked. One bad match on
one run is then re-read forever, and it will never self-correct. Given that Yuyutei's
selection loop never checks the card number, this is a ratchet: bad matches accumulate and
never wash out. The SnkrDunk numbers in §0 are what that ratchet looks like after a few
months.

### The mapping layer

A table, `card_source_mapping`:

```
card_id        uuid      references cards
source         price_source
external_id    text      -- product id where the source has one
external_url   text
external_title text      -- what we matched, as evidence
external_set   text      -- the source's own set/console string
confidence     enum      -- confirmed | derived | rejected
matched_by     text      -- dictionary | product-id | number-token | url | manual
verified_at    timestamptz
unique (card_id, source)
```

Three things make this different from just growing `mapping-dictionary.json`:

- **`rejected` is a first-class value.** "PriceCharting does not list this card" is knowledge.
  Recording it stops 7,000 variant cards from re-searching forever and stops a future
  loosened heuristic from silently filling the gap with a guess. The dictionary can only
  express "mapped"; the absence of a key means both "unknown" and "unmappable".
- **It stores the evidence** (`external_title`, `external_set`), so a mapping can be
  re-verified cheaply and a drift can be detected without re-resolving.
- **It is per-source**, so TCGPlayer's solved problem stops being the only solved problem.
  `mapping-dictionary.json` becomes a seed for `source='tcgplayer'`, not a special case.

**Populating it for ~15k cards × 5 sources** does not need a big bootstrap, because most of
it already exists in `cards`: 4,208 cards have a TCGPlayer price and a `tcg_player_id`, and
Yuyutei/SnkrDunk/Cardrush URLs are already persisted for the cards those workers have
reached. Seed from those, marked `derived` — not `confirmed`, because the URLs were produced
by the unverified loops. Then:

- Split the workers in two. A **resolver** worker walks cards with no mapping for a source,
  does the search once, and writes `confirmed`, `derived` or `rejected`. A **pricer** worker
  only ever prices cards that already have a `confirmed` or `derived` mapping, by
  `external_id`/`external_url`, and asserts the fetched page still names the expected number
  and title before writing. Resolution stops happening 300 times an hour and starts happening
  once per card.
- A card with **no confident mapping produces no price** — not a guessed one. It shows
  "not tracked on <source>" and lands in a review queue. `tcgcsv.ts:49-53` already applies
  exactly this policy for TCGPlayer variants; the comment there is the right policy for the
  whole layer.

### The two open questions

**1. `Krillin [Holo] FB01-008` — is "unique match wins regardless of qualifier" safe?**

No, not as a blanket rule, and the reason is worth being precise about: **uniqueness is a
property of their catalogue, not of the match.** PriceCharting lists a base printing for
most cards, but for some cards it lists *only* the chase printing. On those, the base card's
absence makes the SP row unique — and a unique-match-wins rule hands the $10,545 SP price to
the base card. That is the original failure with an extra step.

Do this instead: make the qualifier taxonomy **data, not a regex**. A small table of
`(game, source, qualifier, means)` where `means ∈ {base_printing, distinct_printing}`. For
Dragon Ball, `[Holo]` is `base_printing` because every FB01 base card is holo — the bracket
is describing the card, not selecting among printings. For One Piece, `[SP Gold]`,
`[Manga PRB01]`, `[Wanted]` and `[2nd Anniversary]` are `distinct_printing`. Then the rule
becomes: accept a row whose qualifiers are all `base_printing`, reject any row carrying an
unknown qualifier, and surface unknown qualifiers as work. That recovers the Dragon Ball
coverage, cannot be fooled by catalogue gaps, and — critically — fails toward "no price"
rather than "some price" when a new qualifier appears.

Roughly 20–40 distinct qualifier strings likely cover the whole catalogue; the way to size
it is to log every bracketed token PriceCharting returns for one full scraper pass before
building anything.

**2. The two unqualified `OP05-119` rows are English and Japanese.**

The scraper already has the answer in the HTML and throws it away. `pricecharting.ts:118-126`
reads only `td.title a`; the row also carries the console/set cell, and the product URL
encodes the language in its path. Japanese callers append `" japanese"` to the query
(`queue-jp-op.ts:83`, `queue-dbfw.ts:66`) and then never check what came back — and because
the loop takes the *first* unqualified row, an English row can and will win for a Japanese
card whenever it ranks higher.

Fix: pass the expected language into the fetcher explicitly rather than smuggling it into
the query string, read the row's set/console cell, and require it to match an expected
value per `(game, language)` — then persist that string as `card_source_mapping.external_set`
so subsequent runs assert against it rather than re-deriving. The cost of getting this wrong
on `OP05-119` is small ($13.71 vs $11.00), which is exactly why it needs a structural fix
rather than a spot check: it is invisible in aggregate until it lands on a card where the
English and Japanese printings differ by 50×.

Worth stating plainly: the language ambiguity affects far more than One Piece promos.
Both Dragon Ball workers (`queue-dbfw.ts:66`) and the Japanese OP worker query PriceCharting
with `" japanese"` and verify nothing.

---

## 3. Conventions that differ per platform, and where they leak

**Currency.** Yuyutei and Cardrush quote JPY and convert; SnkrDunk and TCGPlayer and
PriceCharting quote USD.

- The rate is hardcoded and duplicated: `JPY_TO_USD = 157` at `yuyutei.ts:5` **and**
  `cardrush.ts:5`. Two copies, no shared module, no provenance, and it is only correct on
  the day someone edited it.
- **Four** different numbers for one rate exist in the tree. The ingest constant is 157; the
  comments at `yuyutei.ts:137` and `cardrush.ts:102` both say *"150 JPY = 1 USD"*;
  `queue-jp-op.ts:60` reconstructs the yen figure for its log as `price * 150`, so the logged
  ¥ value is wrong by 4.7% against the conversion actually applied; and `lib/currency.ts:34`
  carries a **fourth**, `JPY: 149.5`, as the display-side fallback.
- That fourth one produces a **double conversion**, which is the user-visible part. A
  Japanese card is converted JPY→USD at a frozen 157 on write, then the display layer
  converts USD→JPY at a live or 149.5 fallback rate (`lib/currency-context.tsx:27-29,100-105`,
  `lib/currency.ts:141-170`). A Japanese user viewing a Japanese card in yen therefore sees a
  yen figure that is not Yuyutei's yen figure and cannot be, round-tripped through a currency
  neither party used, at two different rates.
- The rate is applied at **write** time, so `price_history` stores USD converted at whatever
  the constant was that day, and the native JPY is not retained. JP price history is
  therefore FX-frozen at 157 for its whole span — which happens to make trends readable and
  levels wrong, and there is no way to re-derive the correct value later. This is the
  strongest argument for the `price_native` + `currency` columns in §1.

**SnkrDunk parses two different currencies in one file.** The product-page branch requires
`US\s*\$` before accepting a number (`snkrdunk.ts:45`); the search-results branch parses a
bare `/([0-9.,]+)/` off `.product__item-price` with no currency assertion at all
(`snkrdunk.ts:139-141`). If that element ever renders JPY, the value is stored 157× too high
with nothing to catch it. I could not confirm which currency that element renders without
fetching the page, and the observed 31× median disagreement is a better fit for wrong-product
than for a 157× unit error — but both defects are real and independent. **What would settle
it:** one `curl` of `snkrdunk.com/en/search/result?keyword=OP01-001` and a look at
`.product__item-price`.

**Price semantics.** Five sources, five meanings, one column:

| source | what the number is | code |
|---|---|---|
| TCGPlayer | market price (sales-derived) | `tcgcsv.ts:170` |
| PriceCharting | ungraded guide value from sold listings (shipping excluded, per their methodology) | `pricecharting.ts:134` |
| Yuyutei | Japanese retail *sell* price | `yuyutei.ts:138` |
| Cardrush | **lowest** listing across matches | `cardrush.ts:105` |
| SnkrDunk | marketplace ask | `snkrdunk.ts:139` |

`page.tsx:441-443` sorts these ascending and renders them as "Compared Markets" — a
side-by-side comparison of five quantities that are not comparable, presented as if the
cheapest one is the best deal. PriceCharting's ~$1 effective floor on bulk commons alone
guarantees it sits above TCGPlayer on most of the catalogue, for reasons that have nothing
to do with either card being a better buy.

**Grade vocabulary.** Four spellings are live simultaneously:

- `price_history.grade`: `raw`, `10` (37 rows), `psa10` (8 rows) — both written by SnkrDunk.
  `page.tsx:354` handles this by matching `h.grade === active || h.grade === 'psa'+active`,
  which papers over it correctly but only in that one place.
- `price_cache.graded_prices` keys: `psa10` and `psa-10`.
- PPT/eBay `salesByGrade` keys are normalised through `normalizeGradeKey`
  (`sync-prices.ts:66-68`), which is the only real translation function in the codebase —
  and it is on the path that never writes.
- PriceCharting's own column is `grade10_price` (`pricecharting.ts:144`), mapped to `psa10`
  on the assumption that PriceCharting's "Grade 10" means PSA 10. It does not, strictly —
  it is a blended graded figure. `pricecharting.ts:106-108` already declines to guess grades
  on the product-page path for exactly this reason; the search-table path does guess.

**And the vocabularies meet without translation in four places, each a silent miss.**
`lib/pricing/alerts.ts:144` and `lib/pricing/portfolio.ts:266` both compute
`gradeKey = grade.replace('.', '')`, so a stored grade of `10` looks up `graded_prices['10']`
— but the keys written are `psa10`. **Every graded price alert and every graded holding in
portfolio valuation silently resolves to `null`.** Not an error, not a log line: the feature
appears to work and reports nothing. `app/api/collections/[id]/items/route.ts:109-114`
prefixes correctly for the cache lookup but then compares a numeric `10` against
`price_history.grade` values of `psa10`. And the two add-to-collection surfaces disagree
outright — `components/card/card-detail-actions.tsx:21-27` uses `7`–`10` while
`components/cards/quick-add-dropdown.tsx:15-20` uses `psa7`–`psa10`.

**Condition tiers.** Only PPT exposes them, and PPT never writes. All five scrapers collapse
to a single unlabelled "raw" number, which the page then displays under the "Near Mint"
label via the `?? market` fallback at `page.tsx:331`. Nothing on the page tells the reader
that "Near Mint $0.32" is really "the lowest of two or three incomparable numbers, from a
Japanese retailer, converted at a rate someone typed in".

Worse, where condition tiers do exist they are partly **fabricated**. When the PPT API
returns no `conditions` block, `lib/ppt/client.ts:271-275` synthesises them from near mint by
fixed multipliers — lightly played `× 0.75`, moderately played `× 0.50`, heavily played
`× 0.30`, damaged `× 0.15` — and these are returned indistinguishably from real observations.
The card page renders them as a condition ladder. That path is currently dormant (PPT writes
never land), but it is live in `getCardWithPrices`, which the card page still calls as a
fallback at `page.tsx:318-327`.

**Ranked by user-visible impact:**

1. `market` (min of 2–3 semantics) rendered as **Near Mint** — wrong number, prominent label.
2. SnkrDunk's 31× median error — wrong number, and it wins the `min` whenever it is *low*.
3. Graded alerts and portfolio valuation silently returning `null` — a feature that looks
   functional and is not.
4. Scraper `graded_prices` unreadable — missing data (all PSA prices from scrapers).
5. Set-page `nearMint` — missing data, sitewide.
6. JPY double conversion — wrong number for every JP card shown in a non-USD currency.
7. Fabricated condition tiers — wrong numbers presented as observations, currently dormant.

---

## 4. Where else can a wrong value reach the page?

The general shape of the PriceCharting failure was: *a fetcher with no verification of what
it matched, whose output is trusted unconditionally by the write path.* Applying that lens:

**Ranked by risk:**

1. **SnkrDunk — actively wrong now.** No number check (`snkrdunk.ts:88-135`), no currency
   assertion on the search path (`:139-141`), cached URL re-read without verification. 319
   of 343 comparable cards disagree with Yuyutei by >5×. This source should be switched off
   until it has an identity check.
2. **Yuyutei — same structural hole, better luck.** No number check (`yuyutei.ts:75-127`).
   It survives because Yuyutei's search is exact-ish on card numbers, not because the code
   is safe. Its cached URLs are a permanent ratchet (`yuyutei.ts:21-39`). It is also the
   single source for most JP cards, so nothing would catch it.
3. **PriceCharting — improved, still guessing on two axes.** Language is unverified; the
   `grade10_price → psa10` mapping is asserted; 201 post-cutover cards disagree with
   TCGPlayer by >10×.
4. **Cardrush — sound on discovery, unguarded thereafter.** It checks `{BASENUMBER}`
   (`cardrush.ts:75`) — but only on the search path. Once `cards.cardrush_url` is set, every
   subsequent run takes `cardrush.ts:17-27`, which fetches the stored URL and parses a price
   with no title check at all. It also takes the **lowest** price across matching listings
   (`cardrush.ts:105`), a different quantity from every other source, stored as if it were
   the same. It is the sole source for most DBFW JP cards — no cross-check exists
   (`cardrush`/`yuyutei` overlap on **0** cards).
5. **TCGPlayer — soundest on the search path, and it has the same two holes as everyone
   else.** `matchVariant` refuses to guess variants (`tcgcsv.ts:49-53`), which is the right
   policy. Three caveats. (a) A stored `tcg_player_id` or dictionary entry is priced by ID
   with no number re-check (`tcgcsv.ts:89-113`) — so a wrong ID, once written back by
   `queue-english-op.ts:91`, is permanent. (b) `tcgcsv.ts:46` returns a lone number match
   before the qualifier filter, so a base card whose only listed product is an Alternate Art
   takes the alt-art price. (c) The base-card fallback at `tcgcsv.ts:59` filters with
   `text.includes('sp')` — a substring test, the same class of bug the PriceCharting comment
   describes fixing; here it merely fails closed and costs coverage.

Note the shape of that list: the ranking is really *"how long has this source been
accumulating unverified cached anchors"*. Every source is safest on its first encounter with
a card and least safe on every encounter after.

**A general guard has to work for single-source cards.** That constraint is decisive:
**7,577 of 10,914 priced cards have exactly one source**; 3,137 have two; 200 have three.
Cross-source agreement can only ever cover a third of the catalogue, so it cannot be the
primary defence.

Four layers, in order of value:

1. **Identity assertion at write time — on every fetch, including cached ones.** The pricer
   refuses to write unless the fetched page still names the expected number and matches the
   stored `external_title`/`external_set`. This is the one that would have prevented every
   incident discussed here, and it works for single-source cards. The emphasis on *every*
   fetch is the part currently missing everywhere: today a stored URL or product ID is
   treated as proof of identity rather than as a hypothesis to re-test, which is why bad
   matches ratchet rather than wash out.
2. **Self-consistency against the card's own history.** Reject a new price that is more than
   N× (or 1/N of) the trailing median for that `(card, source)` unless a second source
   corroborates it; quarantine instead of writing. This also works with one source, and it
   is the only guard that catches a source silently changing its page structure.
3. **Per-source distribution checks.** SnkrDunk's $7.00 floor across 423 cards is an alarm
   that a per-source sanity band would have raised months ago. Cheap to compute, cheap to
   alert on.
4. **Cross-source ratio bands — pair-specific, not flat.** PriceCharting/TCGPlayer has a
   median of ~1.25 with a hard $1 floor effect; SnkrDunk/Yuyutei should sit near 1. A flat
   10× threshold fires on ~200 correct cards and misses genuinely wrong ones inside the band.

And one meta-guard: **stop discarding write errors.** The `price_cache` upsert has failed
100% for weeks while the workers logged and continued (`queue-jp-op.ts:137-139`), and the
`upsertPriceCache` fallback was written to handle a failure mode its `catch` cannot observe.
A write path that cannot fail loudly cannot be trusted to be working.

The same principle applies to *reads*. The graded-alert and portfolio lookups in §3 resolve
to `null` on a key mismatch and carry on — no error, no metric, no log. A read path that
returns "no data" for a structural reason is indistinguishable from one that returns "no
data" because there genuinely is none, and both features have presumably looked merely
unpopular rather than broken.

---

## 5. What to change, in what order

**Structurally wrong** — these need design, not patches:

1. **Resolution happens inside pricing.** No persisted identity, so every fetch re-guesses.
   §2. This is the root cause; everything else in this list is downstream of it.
2. **`price_cache` uniqueness, and the duplicate-append fallback.** Portfolio, alerts and
   collections are erroring today via `.single()`. §1.
3. **`market` = `min()` of 2–3 incomparable quantities, displayed as "Near Mint".** §1, §3.
4. **SnkrDunk has no identity check at all.** Disable the source until it does — it is
   currently contributing 319 known-bad comparisons and it can win the `min`.
5. **Cached anchors are never re-verified, by any source.** A stored URL or `tcg_player_id`
   is treated as proof rather than a hypothesis, so every bad match is permanent. §4.
6. **`price_history` is mutable.** `UPDATE … SET card_id` and threshold deletes have already
   rewritten the fact table this design would be rebuilt on. §1.
7. **Grade tokens meet without translation**, silently nulling graded alerts and portfolio
   valuation. §3.
8. **Write errors are discarded, and structural read failures are indistinguishable from
   empty results.** §4.

**Merely untidy** — real, but they cost maintenance rather than correctness:

- Four near-identical workers duplicating client setup, sleep, reshaping, upsert and history
  insert. The reshaping block is byte-identical across all four; extract it and the identity
  guard lands in one place instead of four.
- `queue-english-dbfw.ts` is not in `ecosystem.config.cjs` — English Dragon Ball is never
  scraped. Either register it or delete it; right now it is a file that looks live.
- Dead branches: `yuyutei.ts:94-100` and `snkrdunk.ts:109-114` test `suffix === 'p7'` after
  `:85`/`:101` already consumed `p7`, so the gold-parallel arm is unreachable in both.
- The underscore-only convention split: `yuyutei.ts:13,55`, `snkrdunk.ts:13,68` and
  `tcgcsv.ts:120` test `includes('_')`/`split('_')`, so all 919 dash-suffixed Dragon Ball
  variants are treated as base cards. `pricecharting.ts:15` and `cardrush.ts:45` handle both.
  (Low impact *today* only because Yuyutei and SnkrDunk are One Piece sources — it becomes a
  live bug the moment either is pointed at Dragon Ball.)
- Residue: `scripts/price-engine/tcgrepublic.ts` is imported by nothing, yet the card page
  still ships a logo mapping for it (`page.tsx:27-28`); `ppt-api` rows are stale since
  2026-07-11 and filtered out at `page.tsx:350`; `lib/ppt/service.ts:219` still writes the
  seconds-TTL meaning; the `price_source` enum carries six values with zero rows (`ebay`,
  `pwcc`, `goldin`, `heritage`, `user-submitted`, `tcgrepublic`).
- `price_cache_ttl`'s name. Rename it when something else is already touching those files.

**Leave alone:**

- **`price_history`'s shape** — `(card_id, source, grade, price, recorded_at)`, one row per
  observation. It is the one part of this layer that is right, and it is what made this
  analysis possible. Do not compact it, do not make it a cache, do not collapse it to one row
  per card. (Its *mutability* is a separate matter and is on the fix list above.)
- **`pricecharting.ts`'s token matcher and variant refusal.** Correct as far as it goes, and
  the cutover data proves it works. It needs extending (language, qualifiers), not revising.
- **TCGPlayer's refuse-to-guess policy** (`tcgcsv.ts:49-53`) and `mapping-dictionary.json`.
  This is the model the other four sources should be brought up to, not something to relax
  for coverage.
- **The revalidation fencing** in the workers and `sync-prices.ts`. Unrelated to this review
  and evidently well-reasoned.

**Suggested order:**

1. Purge the currently-wrong data: the ~124 pre-deploy re-poisoned cards and all SnkrDunk
   rows. Disable SnkrDunk. *(Do this first — it is live on the site now.)*
2. Fix the grade-token mismatches at `alerts.ts:144`, `portfolio.ts:266` and
   `collections/[id]/items/route.ts:109-114`. One-line changes that restore two features
   that currently return nothing; no design work required.
3. Revoke `UPDATE`/`DELETE` on `price_history` and retire the `rearrange-*` scripts, so the
   fact table stops moving under everything else.
4. Extract the shared write path from the four workers; make write errors fatal-and-visible;
   fix the `graded_prices` shape.
5. Add the identity assertion (§4.1) to the shared path — including on cached URLs and stored
   product IDs — and the self-consistency guard (§4.2).
6. Dedupe + apply migration `003`. **Not before step 4** — a working upsert simply propagates
   the `market` aggregate faster.
7. `card_source_mapping` and the resolver/pricer split (§2), starting with PriceCharting
   language and the qualifier allowlist.
8. `card_price_current`, repoint the readers, delete the render-time write at
   `page.tsx:370-381`, drop `price_cache`.

Steps 1–3 are hours of work and independent of everything else; 4–6 are a week; 7–8 are the
actual redesign.

---

## Open question

**What is still writing ~1–3 `price_cache` rows per hour?** The 42P10 is proven, and no
current code path uses a conflict target that both parses and matches. Yet rows keep landing
(all `-ja`, all `{market, yuyutei}`-shaped, `source` left at its `'ppt'` default), and they
**append duplicates** rather than updating — `op-op01-079-ja` gained a second row at
2026-07-27 04:21. Writes ran at 350–2,000/day through 2026-07-26 and then collapsed. The
shape says `queue-jp-op.ts`; the code says that is impossible.

Most likely explanation: the deployed scraper image predates the current `onConflict`
argument, and the collapse coincides with a redeploy. That would also explain the 08:21 UTC
variant-scrape cutover on 2026-07-27, which is ~1.5h after the last remediation commit
rather than at it.

**What would settle it:** the running container's image SHA against `git log`, and
`pm2 logs scraper-jp-op` grepped for the `Failed to upsert price_cache` line from
`queue-jp-op.ts:138`. If that line is absent, the deployed code is not the code in this
repository — which is worth knowing well beyond this review.
