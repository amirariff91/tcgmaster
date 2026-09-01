---
name: "Card Price Accuracy Corrections"
description: "Rules and patterns for identifying and fixing mismatched card sources (e.g. PriceCharting, Snkrdunk) to ensure accurate pricing."
---

# Card Price Accuracy & Mismatch Patterns

> [!NOTE] 
> **Scope:** The patterns below were derived specifically from **Japanese One Piece** card mappings. They should be prioritized when auditing or running automated fixes for `one-piece` cards (specifically the `-ja` language suffix). When replicating this success to other TCG IPs (like Pokemon or Lorcana), these patterns should be tested and adapted to fit the specific numbering and naming conventions of those games.

When executing automated mapping fixes or auditing source URLs for cards, ALWAYS apply the following learned patterns:

## Pattern 1: Variant Suffix Ignorance (One Piece Alt Arts / Manga / Wanted / SP / Serialized)
**Symptom:** Highly valuable Alt Art, Manga, Serialized, or "Wanted" style cards are incorrectly mapped to the much cheaper "Base" version of the card on PriceCharting, Snkrdunk, and Yuyutei.
**Root Cause:** The database stores the card number with a variant suffix (e.g., `OP05-119_p2`, `OP13-120_p4`, `ST01-001_p3`). The automated mapping script frequently tokenizes this by stripping the suffix, searching only for `OP05-119`. This causes it to match the standard Base card instead of the Alternate Art, Manga, or Serialized variant.
**Additionally:** The database `rarity` field often just says `SecretRare` or `Leader` instead of identifying it as `Manga`, `Super Parallel`, `Special`, or `Serialized`.
**Resolution Logic:** 
- When matching URLs, if the local card slug contains a `_p` suffix (e.g., `_p1`, `_p2`, `_p3`), the external listing MUST contain keywords like `Alternate Art`, `Manga`, `Parallel`, `Super Parallel`, `SP`, `Special`, `Wanted`, `Serialized`, `Serial Number`, or `Serial Prize`. 
- If a listing does NOT have those keywords, it is the base card and MUST be rejected for `_p` variants.

## Pattern 2: Promo & Magazine Supplements (P- Prefix)
**Symptom:** Promo cards (where the card number starts with `P-`) fail to map on PriceCharting or map to the wrong ID/language on SnkrDunk.
**Root Cause:** The local database name is usually extremely simple (e.g., `"Smoker"`), but external sources like PriceCharting and SnkrDunk differentiate these by appending the magazine/event name (e.g., `(Saikyo Jump)`, `July 2024 Issue Supplement`). Fuzzy matching gets confused by this missing context and either fails entirely or links the wrong listing.
**Resolution Logic:**
- For cards starting with `P-`, the PriceCharting set is almost always `one-piece-japanese-promo` (or English equivalent).
- External titles will contain publication contexts (like `Saikyo Jump`, `V Jump`, `Tournament`). Do not penalize fuzzy match scores if the external source contains these extra words while the local DB does not.
- For SnkrDunk, explicitly check if the listing indicates the correct language and issue supplement to prevent linking a generic English promo to a Japanese mega-promo.

## Pattern 3: Tournament & Event Prizes (Top 8 / Flagship / Winner)
**Symptom:** Tournament prize cards fail to map entirely, or map to the wrong regional stamped version (e.g., Asia vs Japan).
**Root Cause:** The local database seeding scripts sometimes generically mislabel variants (e.g., assuming `_p2` always means "Manga" when for this card it actually meant a Top 8 promo). External sources identify these by event names (`Flagship Battle`, `Top 8`, `Winner`). Furthermore, tournament cards often have identical art with different regional stamps ("For Asia" vs "For Japan").
**Resolution Logic:**
- Look for event keywords in external titles: `Top 8`, `Flagship`, `Winner`, `Championship`, `Tournament`. 
- Do not trust the local DB's `variant_type` string blindly if it conflicts with the event context (e.g., DB says "Manga" but it's in the "Promo" set).
- Distinguish regional stamps: If an external source offers "For Asia" and "For Japan" versions, ensure the mapping aligns with the intended regional target (usually "For Japan" or unstamped for the default JP tracking).

## Pattern 4: Anniversary & Premium Collection Reprints (Promo Leaders)
**Symptom:** "Promo Leaders" or Alt Arts from Premium Collections (e.g. 25th Anniversary) map to the standard base booster version on PriceCharting.
**Root Cause:** The card number (e.g., `OP01-001_p1`) is stripped of its `_p1` suffix by the mapper. Unlike standard `P-` promos which go to a mega-set, PriceCharting actually leaves these reprint Alt Arts in their ORIGINAL booster set (e.g. `romance-dawn`) rather than the `promo` set, but modifies the title to include the event (e.g. `25th Anniversary`, `English 2nd Anniversary`, `Serial Prize`).
**Resolution Logic:**
- For `_p` variants of regular booster cards that belong to the local "Promo" set, PriceCharting may still list them under the original booster set category.
- The external title MUST contain distinguishing keywords like `25th Anniversary`, `Premium Card Collection`, `English 2nd Anniversary`, `Serial Prize`, or `Promo`.
- Reject base matches (e.g. `Roronoa Zoro OP01-001`) that lack these event/anniversary keywords.

## Pattern 5: Variant Ambiguity & Context Deficiency
**Symptom:** A card has a high variant suffix (e.g., `_p5`, `_p6`) but the local database only describes it generically (e.g., `"name": "Marshall.D.Teach (Special Card)"`).
**Root Cause:** Highly popular cards get numerous promotional reprints (SP, Tournament, Anniversary, Premium Collection). The local database often lacks the specific context (like "English 2nd Anniversary") in its name or print run info, making text-based resolution impossible when multiple external promo variants exist.
**Resolution Logic:**
- If an external search for a base number (e.g. `OP09-093`) returns multiple valid promo variants (e.g. an SP version AND an Anniversary version) and the local DB only says "Special Card", **the automated script MUST NOT guess.**
- These highly ambiguous cards must be flagged for **Manual Curation** (status: `pending`) or require visual verification of the card image/border. Never force a mapping if the exact promo context cannot be verified.

## Pattern 6: Strict Semantic Filtering vs. Suffix Guessing
**Symptom:** Generating curation lists or mapping variants by assuming a suffix means a specific type (e.g., assuming ALL `_p2` are Manga cards).
**Root Cause:** The `_p2` suffix is assigned sequentially and can mean "Manga" for one set, but "Top 8 Promo" or standard "Alternate Art" for another. Filtering purely by `_p2` will return a chaotic mix of variant types.
**Resolution Logic:**
- **NEVER** use suffix-guessing (e.g. `slug LIKE '%_p2'`) to isolate a specific semantic card type like Manga or SP.
- **ALWAYS** query the exact semantic strings known to exist in the database names (e.g., `name ILIKE '%Manga Alternate Art%'` or `name ILIKE '%Special Card%'`).

## Pattern 7: The Base Card Inverse Constraint
**Symptom:** Standard base cards (e.g. `OP09-061`) incorrectly map to their own highly valuable Alternate Art or Manga variants.
**Root Cause:** The search query for the base card (e.g. "Monkey.D.Luffy OP09-061") returns the Manga version in the results. If the mapping engine does not explicitly REJECT variant keywords for base cards, it will accept the Manga listing as a valid match.
**Resolution Logic:**
- If the card being mapped is a **Base Card** (e.g., no `_p` in the slug), you MUST actively reject any external listing that contains variant keywords (`Manga`, `Alternate Art`, `Parallel`, `SP`, `Special`).
- This is the exact inverse of Pattern 1. Variant cards MUST have variant keywords; Base cards MUST NOT have variant keywords.

## Pattern 8: Multi-Grade Data Sourcing Rule
**Symptom:** Graded card histories are incomplete because the scraper only fetches `PSA 10` prices.
**Root Cause:** Legacy implementations often hardcode `.includes('PSA 10')` when parsing tables and size lists on Snkrdunk and PriceCharting.
**Resolution Logic:**
- **Raw Cards:** Data MUST be aggregated from all three primary sources (Snkrdunk, PriceCharting, Yuyutei).
- **Graded Cards:** Data MUST be aggregated from Snkrdunk and PriceCharting.
- **Supported Grades:** When parsing graded tables, scrapers MUST extract and store prices for all available grading companies and tiers (e.g. `PSA`, `BGS`, `CGC`, `ARS`). The data structures must use dictionaries (e.g., `gradedPrices: Record<string, number>`) instead of single `gradedPrice` properties to support this multiplicity.

## Pattern 9: Cross-Platform Extreme Mismatch Guard
**Symptom:** Generating a headline price or updating the database when one platform reports $1,000+ (e.g. Snkrdunk) and another reports $7 (e.g. PriceCharting).
**Root Cause:** Highly valuable variants are often mis-aggregated with Base cards by text-based aggregators (like PriceCharting). However, natural market variance (e.g. $100 vs $200 between sellers) is completely normal and should NOT be penalized.
**Resolution Logic:**
- NEVER aggressively quarantine a price based on minor percentage differences (e.g., 20% or 50% differences) across platforms.
- ONLY quarantine a cross-platform price when the difference crosses a massive **catastrophe boundary** (e.g., > 10x ratio difference).
- A 10x+ ratio usually indicates a structural mapping error (e.g., Base card vs Manga card), whereas a 2x-3x ratio is just natural seller variance.

## Pattern 10: Quarantine Migration (No Delete Data)
**Symptom:** A card has a completely incorrect URL mapped (e.g., Manga Shanks points to the $7 Base Shanks on PriceCharting). Fixing the URL in the database does NOT erase the corrupted historical data, leaving the charts poisoned permanently.
**Root Cause:** The system must purge the old data, but strict "no delete data" policies prevent dropping rows from `price_history`.
**Resolution Logic:**
- **NEVER** use `DELETE FROM price_history` without a backup.
- **ALWAYS** perform a **Quarantine Migration**: Move the corrupted rows from `price_history` into the `price_quarantine` table (e.g., `INSERT INTO price_quarantine SELECT ... FROM price_history`, then `DELETE FROM price_history`).
- This instantly scrubs the frontend UI charts (which strictly pull from `price_history`) while permanently preserving the data in the quarantine vault for auditing.
- Follow up by scrubbing the corrupted source from `card_price_current` and triggering a re-scrape to populate the fresh, correct data.
