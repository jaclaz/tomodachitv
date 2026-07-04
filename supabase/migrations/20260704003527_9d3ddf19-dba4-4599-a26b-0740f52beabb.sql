-- Restrict avatars bucket reads to owning user's folder
DROP POLICY IF EXISTS "Authenticated can view avatars" ON storage.objects;
CREATE POLICY "Users can view own avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- Prevent self-follow
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
ON public.follows FOR INSERT TO authenticated
WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);