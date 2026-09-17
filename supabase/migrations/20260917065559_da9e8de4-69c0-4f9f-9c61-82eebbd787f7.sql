
DROP POLICY IF EXISTS "Follows are viewable by authenticated users" ON public.follows;

CREATE POLICY "Users can view their own follow relationships"
ON public.follows
FOR SELECT
TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE OR REPLACE FUNCTION public.is_follower(_follower uuid, _following uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = _follower AND following_id = _following
  )
$$;

CREATE OR REPLACE FUNCTION public.get_follower_ids(_user_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT follower_id FROM public.follows
  WHERE following_id = _user_id AND auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.get_following_ids(_user_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT following_id FROM public.follows
  WHERE follower_id = _user_id AND auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.get_follow_counts(_user_id uuid)
RETURNS TABLE(followers_count bigint, following_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*) FROM public.follows WHERE following_id = _user_id AND auth.uid() IS NOT NULL),
    (SELECT count(*) FROM public.follows WHERE follower_id = _user_id AND auth.uid() IS NOT NULL)
$$;

REVOKE ALL ON FUNCTION public.get_follower_ids(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_following_ids(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_follow_counts(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_follower_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_following_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO authenticated, service_role;
