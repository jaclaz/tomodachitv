GRANT EXECUTE ON FUNCTION public.is_follower(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;