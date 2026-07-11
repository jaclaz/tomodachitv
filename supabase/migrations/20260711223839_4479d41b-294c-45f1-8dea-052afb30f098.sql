REVOKE EXECUTE ON FUNCTION public.get_user_watch_totals(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_watch_totals(uuid) TO service_role;