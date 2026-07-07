REVOKE EXECUTE ON FUNCTION public.is_follower(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_follower(uuid, uuid) TO authenticated, service_role;