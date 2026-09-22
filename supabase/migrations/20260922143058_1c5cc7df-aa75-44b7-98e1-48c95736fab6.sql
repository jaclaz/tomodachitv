DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Public profiles viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (username IS NOT NULL OR id = auth.uid());