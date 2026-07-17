-- 006: Enable RLS on the public catalog tables.
--
-- These tables were exposed via PostgREST with RLS disabled AND full write grants
-- to anon/authenticated. Since NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ships in the
-- browser bundle, anyone could DELETE/TRUNCATE the catalog. Grants were revoked as
-- the immediate mitigation; this migration adds RLS as the durable inner gate and
-- records both in version control.
--
-- Reads must keep working: createPublicClient() (lib/supabase/client.ts) queries
-- cards/sets/games/search_analytics as `anon`. RLS with no policy denies all, so
-- every publicly-read table gets an explicit SELECT policy.
--
-- Writers are unaffected: createServerClient() and the scrapers use
-- SUPABASE_SECRET_KEY (service_role), which bypasses RLS.

-- ============== Outer gate: no writes for end users ==============
-- service_role keeps full access; `authenticated` keeps writes only on the
-- user-owned tables (collections, collection_items, price_alerts, users,
-- notification_queue, user_achievements), which have their own RLS policies.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.cards, public.card_variants, public.cert_history, public.games,
  public.graded_cards, public.grading_companies, public.population_reports,
  public.price_cache, public.price_history, public.price_suggestions,
  public.search_analytics, public.set_completion, public.sets, public.trending_scores
FROM authenticated;

-- ============== Inner gate: RLS + explicit public-read policies ==============

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE graded_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE population_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_suggestions ENABLE ROW LEVEL SECURITY;

-- Public catalog data: readable by everyone, writable only by service_role.
CREATE POLICY "Public read" ON cards              FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Public read" ON card_variants      FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Public read" ON cert_history       FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Public read" ON games              FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Public read" ON graded_cards       FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Public read" ON grading_companies  FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Public read" ON population_reports FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Public read" ON price_cache        FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Public read" ON price_history      FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Public read" ON sets               FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Public read" ON trending_scores    FOR SELECT TO anon, authenticated USING (TRUE);

-- search_analytics: getPopularSearches() (lib/search/service.ts) reads this as anon,
-- so it needs a SELECT policy — but session_id/user_id are PII. RLS is row-level and
-- cannot hide a column, so restrict the readable columns with column-level grants.
CREATE POLICY "Public read" ON search_analytics FOR SELECT TO anon, authenticated USING (TRUE);
REVOKE SELECT ON search_analytics FROM anon, authenticated;
GRANT SELECT (id, card_id, search_query, result_clicked, created_at)
  ON search_analytics TO anon, authenticated;

-- set_completion: per-user progress, NOT catalog — scoped to the owner in 007.
-- price_suggestions: unused by the app today. schema.sql intended authenticated-read;
-- keep it service_role-only until the feature exists (no policy = deny by default).
