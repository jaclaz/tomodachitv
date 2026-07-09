
CREATE OR REPLACE FUNCTION public.get_user_watch_totals(_user_id uuid)
RETURNS TABLE (
  total_episodes bigint,
  total_movies bigint,
  episode_minutes bigint,
  movie_minutes bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.watched_episodes WHERE user_id = _user_id),
    (SELECT count(*) FROM public.watched_movies WHERE user_id = _user_id),
    COALESCE((SELECT sum(runtime_minutes)::bigint FROM public.watched_episodes WHERE user_id = _user_id), 0),
    COALESCE((SELECT sum(runtime_minutes)::bigint FROM public.watched_movies WHERE user_id = _user_id), 0);
$$;
REVOKE ALL ON FUNCTION public.get_user_watch_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_watch_totals(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.pending_media_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('watched_episode','watched_movie','follow_show','follow_movie')),
  source text NOT NULL CHECK (source IN ('tvdb','tmdb','imdb','name')),
  source_id text NOT NULL,
  title text,
  year integer,
  season_number integer,
  episode_number integer,
  runtime_minutes integer,
  watched_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_media_imports_uidx
  ON public.pending_media_imports (user_id, kind, source, source_id, COALESCE(season_number, -1), COALESCE(episode_number, -1));
CREATE INDEX IF NOT EXISTS pending_media_imports_user_idx ON public.pending_media_imports(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_media_imports TO authenticated;
GRANT ALL ON public.pending_media_imports TO service_role;

ALTER TABLE public.pending_media_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own pending imports" ON public.pending_media_imports;
CREATE POLICY "Users manage own pending imports"
  ON public.pending_media_imports FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS pending_media_imports_updated_at ON public.pending_media_imports;
CREATE TRIGGER pending_media_imports_updated_at
  BEFORE UPDATE ON public.pending_media_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
