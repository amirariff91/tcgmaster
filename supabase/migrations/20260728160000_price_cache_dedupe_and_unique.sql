-- Applied to prod 2026-07-28 ~08:15 UTC via MCP; mirrored here for parity.
-- Supersedes the never-applied 003_fix_price_cache_uniqueness.sql (deleted in this commit).
-- price_cache accumulated duplicate rows per card because the historical upsert used
-- onConflict:'card_id' with no matching unique constraint (42P10) while a fallback
-- appended rows; four .single() readers (portfolio, alerts, collections) errored on the
-- duplicated cards. Dedupe keeping the newest row by fetched_at, then add the constraint
-- the writers were always assuming. The current writer does delete-then-insert, correct
-- both before and after this constraint.

DELETE FROM price_cache pc
USING price_cache newer
WHERE newer.card_id = pc.card_id
  AND (newer.fetched_at > pc.fetched_at
       OR (newer.fetched_at = pc.fetched_at AND newer.id > pc.id));

ALTER TABLE price_cache ADD CONSTRAINT price_cache_card_id_unique UNIQUE (card_id);
