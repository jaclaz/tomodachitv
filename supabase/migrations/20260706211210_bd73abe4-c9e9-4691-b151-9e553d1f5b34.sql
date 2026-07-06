-- Add profile banner support
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url text;

-- Banner storage policies: users manage their own folder; signed URLs make them readable
DROP POLICY IF EXISTS "Authenticated can view banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own banners" ON storage.objects;
CREATE POLICY "Users can view own banners"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "Users upload own banner" ON storage.objects;
CREATE POLICY "Users upload own banner"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'banners'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own banner" ON storage.objects;
CREATE POLICY "Users update own banner"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'banners'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own banner" ON storage.objects;
CREATE POLICY "Users delete own banner"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'banners'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );