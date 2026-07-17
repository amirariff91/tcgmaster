-- Provision public user profiles and default collections for new auth users.
--
-- public.users has RLS enabled (001_initial_schema.sql:571) with only SELECT and
-- UPDATE policies, so the signup callback's insert (made with the user's own session)
-- was silently denied and its error discarded. Result: auth.users had 4 rows while
-- public.users had 0, and every FK-dependent feature (collections, price_alerts)
-- failed. Provision in the database instead, where RLS does not apply.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    display_name,
    avatar_url,
    is_founding_collector
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url',
    true
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.collections (user_id, name, type, is_public)
  SELECT NEW.id, 'My Collection', 'personal'::public.collection_type, false
  WHERE EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = NEW.id
  )
    AND NOT EXISTS (
      SELECT 1
      FROM public.collections
      WHERE user_id = NEW.id
        AND name = 'My Collection'
    )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION
  -- Never let a provisioning failure block authentication itself; surface it in the
  -- Postgres logs instead. The backfill below can repair anyone this misses.
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to provision public data for auth user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Backfill auth users that predate the provisioning trigger.
INSERT INTO public.users (
  id,
  email,
  display_name,
  avatar_url,
  is_founding_collector
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data ->> 'display_name', split_part(au.email, '@', 1)),
  au.raw_user_meta_data ->> 'avatar_url',
  true
FROM auth.users AS au
LEFT JOIN public.users AS pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.collections (user_id, name, type, is_public)
SELECT
  au.id,
  'My Collection',
  'personal'::public.collection_type,
  false
FROM auth.users AS au
JOIN public.users AS pu ON pu.id = au.id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.collections AS c
  WHERE c.user_id = au.id
    AND c.name = 'My Collection'
)
ON CONFLICT DO NOTHING;
