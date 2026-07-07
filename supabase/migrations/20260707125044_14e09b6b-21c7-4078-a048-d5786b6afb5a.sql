ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_url_source_check
  CHECK (
    avatar_url IS NULL
    OR avatar_url = ''
    OR avatar_url ~ '^https://kozxbrvemnfizxwvrsch\.supabase\.co/storage/v1/object/(public|sign)/'
  );

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_banner_url_source_check
  CHECK (
    banner_url IS NULL
    OR banner_url = ''
    OR banner_url ~ '^https://kozxbrvemnfizxwvrsch\.supabase\.co/storage/v1/object/(public|sign)/'
  );