-- 007: Fix set_completion exposure introduced by 006.
--
-- set_completion is per-user collection progress (user_id UUID NOT NULL REFERENCES
-- users(id), 001_initial_schema.sql:518-520), not catalog data. 006 misclassified it
-- and granted unrestricted public read, which would have exposed every user's progress
-- once the feature went live. Caught while the table was still empty (0 rows).
DROP POLICY IF EXISTS "Public read" ON set_completion;

CREATE POLICY "Users can view own set completion" ON set_completion
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
