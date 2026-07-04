CREATE TABLE public.media_cache (
  media_type text NOT NULL CHECK (media_type IN ('tv','movie')),
  tmdb_id integer NOT NULL,
  title text,
  poster_path text,
  backdrop_path text,
  vote_average numeric,
  release_date date,
  genre_ids integer[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (media_type, tmdb_id)
);
GRANT SELECT, INSERT, UPDATE ON public.media_cache TO authenticated;
GRANT ALL ON public.media_cache TO service_role;
ALTER TABLE public.media_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_cache readable by any authenticated" ON public.media_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "media_cache writable by any authenticated" ON public.media_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "media_cache upsertable by any authenticated" ON public.media_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);