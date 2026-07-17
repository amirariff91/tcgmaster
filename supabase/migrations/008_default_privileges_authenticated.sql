-- 008: Close the default-privileges gap left by 006.
--
-- 006 revoked default write privileges from anon but not authenticated, so any NEW
-- public table would still be created with authenticated DML grants, re-opening the
-- same hole for every future table. Close it symmetrically.
--
-- Note: supabase/migrations/002 defines price_history_ohlc without RLS. That table
-- does not exist in the live DB (002 was never applied). If it is ever applied, it
-- needs RLS + a public-read policy like the other catalog tables in 006.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM authenticated;
