-- Add username to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS bio text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- Everyone (signed-in) can read minimal profile info to enable discovery
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Follows table
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by authenticated users"
  ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- Helper: is follower?
CREATE OR REPLACE FUNCTION public.is_follower(_follower uuid, _following uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _follower AND following_id = _following);
$$;

-- Watchlist: allow public read (discovery), keep write scoped to owner
DROP POLICY IF EXISTS "Users manage own watchlist" ON public.watchlist;
CREATE POLICY "Watchlist readable by authenticated users"
  ON public.watchlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own watchlist"
  ON public.watchlist FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own watchlist"
  ON public.watchlist FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own watchlist"
  ON public.watchlist FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Watched episodes: owner or follower can read
DROP POLICY IF EXISTS "Users manage own watched episodes" ON public.watched_episodes;
CREATE POLICY "Watched episodes readable by owner or followers"
  ON public.watched_episodes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_follower(auth.uid(), user_id));
CREATE POLICY "Users insert own watched episodes"
  ON public.watched_episodes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own watched episodes"
  ON public.watched_episodes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own watched episodes"
  ON public.watched_episodes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Watched movies: owner or follower
DROP POLICY IF EXISTS "Users manage own watched movies" ON public.watched_movies;
CREATE POLICY "Watched movies readable by owner or followers"
  ON public.watched_movies FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_follower(auth.uid(), user_id));
CREATE POLICY "Users insert own watched movies"
  ON public.watched_movies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own watched movies"
  ON public.watched_movies FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own watched movies"
  ON public.watched_movies FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Update handle_new_user to seed a base username from email/full_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username text;
  candidate text;
  suffix int := 0;
BEGIN
  base_username := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    '[^a-z0-9_]', '', 'g'
  ));
  IF base_username IS NULL OR length(base_username) < 3 THEN
    base_username := 'user' || substr(NEW.id::text, 1, 8);
  END IF;
  candidate := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = candidate) LOOP
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    candidate,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill usernames for existing profiles missing one
DO $$
DECLARE r record; base text; candidate text; suffix int;
BEGIN
  FOR r IN SELECT p.id, u.email FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.username IS NULL LOOP
    base := lower(regexp_replace(split_part(r.email, '@', 1), '[^a-z0-9_]', '', 'g'));
    IF base IS NULL OR length(base) < 3 THEN base := 'user' || substr(r.id::text, 1, 8); END IF;
    candidate := base; suffix := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = candidate) LOOP
      suffix := suffix + 1; candidate := base || suffix::text;
    END LOOP;
    UPDATE public.profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;