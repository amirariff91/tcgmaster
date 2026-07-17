-- 011: Fix an anon read break introduced by 010.
--
-- 010 gave anon a collection_items policy whose USING clause subqueries collections,
-- but 010 also revoked anon's table-level SELECT on collections — so the subquery
-- failed with "permission denied for table collections" and anon reads of
-- collection_items errored instead of returning public rows.
--
-- anon does not need direct collection_items access: the public share path in
-- app/api/collections/[id]/route.ts reads via service_role with an explicit safe
-- projection. Removing the anon grant/policy is stricter and drops the broken
-- dependency. Caught before any collection was ever shared (0 public collections).
DROP POLICY IF EXISTS "Public collection items are readable" ON public.collection_items;
REVOKE SELECT ON public.collection_items FROM anon;
