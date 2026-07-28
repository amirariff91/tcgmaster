-- Corrections are henceforth compensating rows (new observations), never edits.
-- Admin/postgres-role migrations can still purge when unavoidable.

REVOKE UPDATE, DELETE ON price_history FROM anon, authenticated, service_role;
