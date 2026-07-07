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
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_follower(uuid, uuid) TO authenticated, service_role;