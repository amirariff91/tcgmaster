# WP7b pricer split

- Queue workers now load confirmed/derived `card_source_mapping` rows once per card and pass only those mappings to each source fetcher. Missing mappings advance `last_price_fetch` without performing a search.
- TCGPlayer, Yuyutei, Cardrush, and PriceCharting each have anchor-only entry points. The existing search exports remain available for the resolver, but queue scripts no longer call them.
- Persistence now quarantines conservative stored-title/fetched-title drift, requests mapping reverification, and no longer writes legacy source URL columns.
- `fetchTcgplayerByAnchor` accepts an optional category ID so the existing DBFW TCGCSV category 80 behavior is retained while the mapping external ID remains the anchor.

Concerns:

- PriceCharting anchors must be product URLs; a mapping with only an ID is intentionally skipped by the queue.
- Reverification failures are logged and do not abort a batch after title drift, so the drift quarantine remains durable even if the mapping update is temporarily unavailable.
- `npx tsc --noEmit` reaches only the known pre-existing `app/admin/health` errors; full Vitest verification passes (50 tests).
