-- WP8c: drop the legacy price_cache table.  card_price_current (WP8a) is the
-- durable one-row-per-card projection; all readers were repointed in WP8b and
-- the scraper compat write was removed in the commit shipping this migration.
-- Apply ONLY after web + scrapers + Inngest are verified running WP8c builds.

DROP TABLE IF EXISTS price_cache;
