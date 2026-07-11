DELETE FROM public.pending_media_imports AS pending
USING public.profiles AS profile
WHERE pending.user_id = profile.id
  AND lower(profile.username) = 'mettignis';