
-- 1) Tighten watchlist SELECT policy to owner + followers
DROP POLICY IF EXISTS "Watchlist readable by authenticated users" ON public.watchlist;

CREATE POLICY "Users can read own watchlist"
ON public.watchlist
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Followers can read watchlist"
ON public.watchlist
FOR SELECT
TO authenticated
USING (public.is_follower(auth.uid(), user_id));

-- 2) Convert is_follower to SECURITY INVOKER and lock down EXECUTE.
--    follows has a SELECT policy allowing authenticated reads, so this still works.
CREATE OR REPLACE FUNCTION public.is_follower(_follower uuid, _following uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = _follower AND following_id = _following
  );
$$;

REVOKE ALL ON FUNCTION public.is_follower(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_follower(uuid, uuid) TO authenticated;

-- 3) handle_new_user is a trigger function; no user should call it directly.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
