REVOKE EXECUTE ON FUNCTION public.is_follower(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_follower(uuid, uuid) TO authenticated;