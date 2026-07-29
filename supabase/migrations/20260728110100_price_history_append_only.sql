-- Corrections are henceforth compensating rows (new observations), never edits.
-- Admin/postgres-role migrations can still purge when unavoidable.
--
-- Known, intentional exception: price_history.card_id is ON DELETE CASCADE (and
-- variant_id ON DELETE SET NULL), so deleting a card during catalog lifecycle work
-- (e.g. duplicate-card merges) still removes its history via referential actions.
-- Append-only here targets price *edits*; catalog deletes remain a deliberate,
-- admin-level operation.

REVOKE UPDATE, DELETE ON price_history FROM anon, authenticated, service_role;
