ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code text;

CREATE TABLE public.trend_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  media_type text NOT NULL,
  tmdb_id integer NOT NULL,
  kind text NOT NULL,
  weight smallint NOT NULL,
  country_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trend_events TO authenticated;
GRANT ALL ON public.trend_events TO service_role;
ALTER TABLE public.trend_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own trend events readable" ON public.trend_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX trend_events_country_time ON public.trend_events (country_code, media_type, created_at DESC);
CREATE INDEX trend_events_time ON public.trend_events (media_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_trend_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  cc text; mt text; k text; w smallint;
BEGIN
  SELECT country_code INTO cc FROM public.profiles WHERE id = NEW.user_id;
  IF TG_TABLE_NAME = 'watchlist' THEN mt := COALESCE(NEW.media_type,'tv'); k := 'watchlist'; w := 2;
  ELSIF TG_TABLE_NAME = 'watched_episodes' THEN mt := 'tv'; k := 'watch'; w := 3;
  ELSIF TG_TABLE_NAME = 'watched_movies' THEN mt := 'movie'; k := 'watch'; w := 3;
  ELSIF TG_TABLE_NAME = 'user_ratings' THEN mt := NEW.media_type; k := 'rating'; w := 4;
  ELSIF TG_TABLE_NAME = 'favorites' THEN mt := NEW.media_type; k := 'like'; w := 4;
  ELSE RETURN NEW; END IF;
  -- one episode event per show per user per hour to avoid binge/import spam
  IF k = 'watch' AND EXISTS (SELECT 1 FROM public.trend_events WHERE user_id = NEW.user_id AND tmdb_id = NEW.tmdb_id AND media_type = mt AND kind = 'watch' AND created_at > now() - interval '1 hour') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.trend_events (user_id, media_type, tmdb_id, kind, weight, country_code)
  VALUES (NEW.user_id, mt, NEW.tmdb_id, k, w, cc);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

CREATE TRIGGER trend_watchlist AFTER INSERT ON public.watchlist FOR EACH ROW EXECUTE FUNCTION public.log_trend_event();
CREATE TRIGGER trend_episodes AFTER INSERT ON public.watched_episodes FOR EACH ROW EXECUTE FUNCTION public.log_trend_event();
CREATE TRIGGER trend_movies AFTER INSERT ON public.watched_movies FOR EACH ROW EXECUTE FUNCTION public.log_trend_event();
CREATE TRIGGER trend_ratings AFTER INSERT OR UPDATE OF rating ON public.user_ratings FOR EACH ROW EXECUTE FUNCTION public.log_trend_event();
CREATE TRIGGER trend_favorites AFTER INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.log_trend_event();

CREATE OR REPLACE FUNCTION public.get_trending_scores(_country text, _media_type text, _limit int DEFAULT 40)
RETURNS TABLE(tmdb_id integer, score double precision, users bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT e.tmdb_id,
    SUM(e.weight * (1.0 / (1.0 + power(EXTRACT(EPOCH FROM (now() - e.created_at)) / 3600.0 / 24.0, 1.5)))) AS score,
    COUNT(DISTINCT e.user_id) AS users
  FROM public.trend_events e
  WHERE auth.uid() IS NOT NULL
    AND e.media_type = _media_type
    AND e.created_at >= now() - interval '7 days'
    AND (_country IS NULL OR e.country_code = upper(_country))
  GROUP BY e.tmdb_id
  ORDER BY score DESC
  LIMIT LEAST(_limit, 100)
$$;
GRANT EXECUTE ON FUNCTION public.get_trending_scores(text, text, int) TO authenticated, service_role;

-- Collaborative: titles in watchlists of users sharing >= 3 high-rated (>=3.5/5) titles with the caller
CREATE OR REPLACE FUNCTION public.get_cowatch_scores(_media_type text)
RETURNS TABLE(tmdb_id integer, peers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH mine AS (
    SELECT media_type, tmdb_id FROM public.user_ratings WHERE user_id = auth.uid() AND rating >= 3.5
  ), peers AS (
    SELECT r.user_id FROM public.user_ratings r JOIN mine m USING (media_type, tmdb_id)
    WHERE r.user_id <> auth.uid() AND r.rating >= 3.5
    GROUP BY r.user_id HAVING COUNT(*) >= 3
  )
  SELECT w.tmdb_id, COUNT(DISTINCT w.user_id) AS peers
  FROM public.watchlist w JOIN peers p ON p.user_id = w.user_id
  WHERE auth.uid() IS NOT NULL AND w.media_type = _media_type
    AND COALESCE(w.status,'') <> 'dropped'
  GROUP BY w.tmdb_id ORDER BY peers DESC LIMIT 60
$$;
GRANT EXECUTE ON FUNCTION public.get_cowatch_scores(text) TO authenticated, service_role;