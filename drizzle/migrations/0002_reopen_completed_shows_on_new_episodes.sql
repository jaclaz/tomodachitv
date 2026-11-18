CREATE OR REPLACE FUNCTION public.reopen_completed_shows()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.media_type = 'tv' AND NEW.episode_count_aired IS NOT NULL AND NEW.episode_count_aired > 0 THEN
    UPDATE public.watchlist w SET status = 'watching'
    WHERE w.media_type = 'tv' AND w.tmdb_id = NEW.tmdb_id AND w.status = 'completed'
      AND (SELECT count(*) FROM public.watched_episodes e
           WHERE e.user_id = w.user_id AND e.tmdb_id = w.tmdb_id AND e.season_number > 0)
          BETWEEN 1 AND NEW.episode_count_aired - 1;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.reopen_completed_shows() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS media_cache_reopen_completed ON public.media_cache;
CREATE TRIGGER media_cache_reopen_completed
AFTER INSERT OR UPDATE OF episode_count_aired ON public.media_cache
FOR EACH ROW EXECUTE FUNCTION public.reopen_completed_shows();

UPDATE public.watchlist w SET status = 'watching'
FROM public.media_cache mc
WHERE mc.media_type = 'tv' AND mc.tmdb_id = w.tmdb_id AND w.media_type = 'tv'
  AND w.status = 'completed' AND mc.episode_count_aired > 0
  AND (SELECT count(*) FROM public.watched_episodes e
       WHERE e.user_id = w.user_id AND e.tmdb_id = w.tmdb_id AND e.season_number > 0)
      BETWEEN 1 AND mc.episode_count_aired - 1;