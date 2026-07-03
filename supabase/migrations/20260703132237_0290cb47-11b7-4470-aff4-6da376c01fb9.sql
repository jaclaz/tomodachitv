
-- 1. Extend watchlist with media_type
ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'tv';

ALTER TABLE public.watchlist
  ADD CONSTRAINT watchlist_media_type_check CHECK (media_type IN ('tv','movie'));

-- Replace old unique constraint (if any) with a widened one
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'watchlist_user_id_tmdb_id_key') THEN
    ALTER TABLE public.watchlist DROP CONSTRAINT watchlist_user_id_tmdb_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS watchlist_user_media_tmdb_uidx
  ON public.watchlist (user_id, media_type, tmdb_id);

-- 2. watched_movies table
CREATE TABLE IF NOT EXISTS public.watched_movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tmdb_id integer NOT NULL,
  title text,
  runtime_minutes integer,
  watched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tmdb_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watched_movies TO authenticated;
GRANT ALL ON public.watched_movies TO service_role;

ALTER TABLE public.watched_movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own watched movies"
  ON public.watched_movies
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
