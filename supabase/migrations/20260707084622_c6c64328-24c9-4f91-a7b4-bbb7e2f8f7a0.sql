CREATE TABLE public.youtube_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  yt_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('channel','playlist','video')),
  title text NOT NULL,
  thumbnail_url text,
  channel_title text,
  channel_id text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, yt_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_watchlist TO authenticated;
GRANT ALL ON public.youtube_watchlist TO service_role;
ALTER TABLE public.youtube_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own yt watchlist all" ON public.youtube_watchlist FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX youtube_watchlist_user_added_idx ON public.youtube_watchlist (user_id, added_at DESC);

CREATE TABLE public.youtube_watched (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  yt_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('channel','playlist','video')),
  title text NOT NULL,
  thumbnail_url text,
  channel_title text,
  channel_id text,
  watched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, yt_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_watched TO authenticated;
GRANT ALL ON public.youtube_watched TO service_role;
ALTER TABLE public.youtube_watched ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own yt watched all" ON public.youtube_watched FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX youtube_watched_user_watched_idx ON public.youtube_watched (user_id, watched_at DESC);