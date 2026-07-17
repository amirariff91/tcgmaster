-- 010: Prevent public collection reads from exposing private collection data.
--
-- The route uses approach (a): owner reads stay on the cookie-aware publishable
-- client, while non-owner public reads use the server-only service-role client
-- with an explicit safe projection. Column grants below protect the direct anon
-- Data API path as well; RLS alone cannot hide columns.

-- ============== Row access ==============
-- Keep owner reads fully available to signed-in users and keep public rows
-- discoverable to anon only. Authenticated non-owners use the route's
-- service-role safe projection rather than reading public rows directly.
DROP POLICY IF EXISTS "Users can view own collections" ON public.collections;
CREATE POLICY "Users can view own collections" ON public.collections
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Public collections are readable" ON public.collections
  FOR SELECT TO anon
  USING (is_public = true);

DROP POLICY IF EXISTS "Users can view own collection items" ON public.collection_items;
CREATE POLICY "Users can view own collection items" ON public.collection_items
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = (SELECT user_id FROM public.collections WHERE id = collection_id)
  );

CREATE POLICY "Public collection items are readable" ON public.collection_items
  FOR SELECT TO anon
  USING (
    (SELECT is_public FROM public.collections WHERE id = collection_id) = true
  );

-- ============== Column access ==============
-- A table-level SELECT grant would expose every column through PostgREST.
-- Revoke it first, then grant only the fields needed to render a public share.
REVOKE SELECT ON public.collections FROM anon;
GRANT SELECT (
  id,
  name,
  type,
  description,
  is_public,
  total_value,
  items_count,
  created_at,
  updated_at
) ON public.collections TO anon;

REVOKE SELECT ON public.collection_items FROM anon;
GRANT SELECT (
  id,
  collection_id,
  card_id,
  variant_id,
  grade,
  grading_company_id,
  cert_number,
  current_value,
  created_at
) ON public.collection_items TO anon;
