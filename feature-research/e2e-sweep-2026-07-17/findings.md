# E2E sweep of tcgmaster.com — findings

**Date:** 2026-07-17 · **Target:** production `https://tcgmaster.com` · **Repo HEAD:** 78af6b3 (clean, untouched)

**Method.** Four independent Codex luna (xhigh) workers drove real browsers against
production under distinct lenses (core navigation, search/market, auth gates/error
states, responsive/console health). Their 10 raw candidates were then argued by
Codex sol (xhigh, prosecution) against Fable 5 (xhigh, defense), and every surviving
claim was re-verified by me directly against production and the source.

**Outcome:** 6 confirmed, 1 plausible (needs an account to close), 3 dropped.
The debate did real work — it killed two findings and corrected a third that all
four workers had mis-measured.

**Coverage.** `/`, `/pokemon`, `/pokemon/base-set`, card detail pages, `/search`,
`/market`, `/login`, `/signup`, `/cert`, the five gated routes, bogus routes, and
`/api/{search,trending,sets,games}` — at desktop, iPhone 12, and Pixel 5 widths.
**Not covered:** any signed-in state (no account was created — production is read-only),
`/decks`, `/blog`, checkout/payment (none exists).

---

## 1. CRITICAL — `/pokemon` is entirely mock data: fabricated prices + dead links

**Confirmed.** `app/[game]/page.tsx` ships placeholder data to production on a site
whose whole proposition is accurate pricing.

- `mockTopCards` (line 109) hardcodes **Charizard $42,000, Lugia $12,500, Blastoise $8,500**
  with invented 24h changes, rendered as real prices at line 263 with no "sample data" disclaimer.
- Its slugs (`charizard-holo`, `lugia-holo`, `blastoise-holo`) **do not exist in the DB**.
  Verified: `/pokemon/base-set/charizard-holo` → HTTP 200 "Card Not Found", while the real
  `/pokemon/base-set/charizard` renders fine. Every "Top Card" recommendation dead-ends.
- The rot is page-wide, not one array: `mockSets` (line 46) fabricates average prices,
  `gamesData` (line 22) fabricates "15,000+ cards tracked", and "Price Updates: Real-time"
  (line 317) is a hardcoded string.
- **Self-refuting to any user:** real card pages honestly render "No Data Yet" for
  Charizard while this page advertises $42,000 for the same card.

Folded in (each is the same root cause, not a separate bug): the fabricated-price harm,
the "card pages show no prices" symptom, and the card route's soft-404 — `app/[game]/[set]/[card]/page.tsx:188`
renders a "Card Not Found" JSX block instead of calling `notFound()`, and I verified that
response carries **no `noindex`**, so these dead links are indexable.

**Fix:** replace `mockTopCards`/`mockSets`/`gamesData` with real queries; make the card
route call `notFound()`.

## 2. HIGH — Production build is stale; homepage hero images are broken

**Confirmed, but no code change needed — this is a deploy.** Six `_next/image` requests for
`onepiece-cardgame.com` hero art return **HTTP 400 `"url" parameter is not allowed`**;
the origin images return 200. The homepage's principal visual is missing.

`next.config.ts:41-48` **already whitelists** both One Piece hosts, added in commit
`6da3b39` (2026-07-16), which is an ancestor of HEAD. Production still rejects it ⇒ the
deployed build predates HEAD.

**This is the most actionable item here:** other fixes already in HEAD may also simply be
undeployed. Redeploy first, then re-test — some of what follows may already be fixed in code.

## 3. HIGH — Header auth state is hardcoded; signed-in users still see "Sign In"

**Plausible — needs an account to close.** `components/layout/header.tsx:25-26` reads
`// Mock user state` / `const user = null;`, and line 65 branches on that constant. Since
`user` can never be truthy, the header renders "Sign In" unconditionally — verified on
production, where "Sign Out"/"My Collection" appear nowhere in the markup.

Read literally, a logged-in user gets no signed-in indicator and no sign-out control, even
though `/collection` etc. are genuinely gated by real Supabase auth in
`lib/supabase/middleware.ts`. I could not drive the logged-in path (no account, production
read-only), so I am reporting the code defect as certain and the user-facing impact as
very likely rather than observed. **This one is mine, not the workers' — no worker logged in.**

## 4. MEDIUM — Base Set is missing 10 cards (31–40)

**Confirmed — and this replaces the finding every worker got wrong.** All four reported
"claims 92 cards but renders 12, no pagination". That was a **measurement artifact**:
`set-page-client.tsx:21` sets `CARDS_PER_BATCH = 12` with IntersectionObserver infinite
scroll, so a non-scrolling headless browser sees exactly 12 by design. The server fetches
all cards with no `.limit()`.

The real defect, found by counting the full payload: Base Set holds **exactly 92 cards with
a contiguous gap at numbers 31–40**, while the cards number themselves `/102`. The `sets`
row itself stores `card_count: 92`, so the displayed count is *accurate* — the data is
incomplete. A contiguous 10-card gap points at an ingestion failure, not random loss.

## 5. MEDIUM — Mobile menu button has no accessible name

**Confirmed.** `components/layout/header.tsx:78-85` is an icon-only `Button` containing only
a Lucide SVG — no `aria-label`, `title`, or visually-hidden text; `aria-expanded` is also
absent. Verified on production: the sole `aria-label` on the homepage is "Loading". Screen
reader users get an unlabelled "button" as the only route into mobile navigation.

Genuine **WCAG 4.1.2 (Name, Role, Value)** failure. One-line fix.

## 6. LOW — `/api/trending` computes nonsense percentages (dark endpoint)

**Confirmed, low because nothing consumes it.** Every item returns `currentPrice: null`
alongside `priceChange24h` from **-95.7% to +3584.2%** on `volume24h` of 3.

- `null` price is a marked TODO: `lib/pricing/trending.ts:146` (`// Would need to join price_cache`).
- The percentages are a real algorithm bug (`lib/pricing/trending.ts:274-288`): it diffs the
  last two `price_history` rows with **no filter on grade, variant, or age**, so a raw-$12 row
  against a PSA10-$450 row yields +3584%. `previous` is also unguarded against zero, and
  nothing constrains the rows to 24h despite the field name.

Both debaters independently confirmed no UI consumes this endpoint. **Fix before wiring it
to any pricing UI** — as a valuation input these numbers would be actively harmful.

## 7. LOW — `/pokemon` is undiscoverable from the homepage

**Confirmed, UX note.** Header nav is only Prices→`/search` and Decks
(`components/layout/header.tsx:16-19`); the homepage's sole CTA goes to `/search`
(`app/page.tsx:97`); homepage category tiles (One Piece, Dragon Ball) aren't links.
`/pokemon` is reachable and in the sitemap but unlinked.

Arguably moot until finding 1 is fixed — you may not *want* to promote a page of
placeholder data.

---

## Dropped after debate

- **Invalid routes return HTTP 200 (`/notagame`, `/pokemon/fake-set`)** — *not a bug.* The code
  correctly calls `notFound()` (`app/[game]/page.tsx:163`, `app/[game]/[set]/page.tsx:173`).
  I verified both responses **do** carry `<meta name="robots" content="noindex">` — this is
  standard App Router streaming behaviour. Only the card route's soft-404 survived (folded into finding 1).
- **Touch targets below 44px** — *not a violation.* Sign In is 32px, hamburger 40px. WCAG 2.2 AA
  SC 2.5.8 requires **24×24**; both pass. 44×44 is Apple HIG / WCAG AAA, not an AA requirement.
  The worker cited the wrong standard. Ergonomic nice-to-have at most.
- **"Base Set renders only 12 cards / no pagination"** — *measurement artifact*, see finding 4.

## Bonus: an existing test is already failing

`e2e/auth-flows.spec.ts:9-12` asserts `redirect=%2Fsettings`, but production (and
`lib/supabase/middleware.ts`) emit **`redirectTo=`**. Verified:
`/collection` → `307 → /login?redirectTo=%2Fcollection`. That spec should be red today.

## Suggested order

1. **Redeploy** (finding 2) — free, and may already resolve others.
2. Rip out the mock data on `/pokemon` (finding 1) — the credibility risk.
3. Fix the header auth state (finding 3) and the hamburger label (finding 5) — both small.
4. Investigate the Base Set 31–40 ingestion gap (finding 4).
5. Fix `trending`'s grade mixing before it gets a consumer (finding 6).
