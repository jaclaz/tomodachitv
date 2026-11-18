CREATE OR REPLACE FUNCTION public.reopen_completed_shows()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE airing boolean;
BEGIN
  IF NEW.media_type = 'tv' AND NEW.episode_count_aired IS NOT NULL AND NEW.episode_count_aired > 0 THEN
    airing := NEW.next_air_date IS NOT NULL AND NEW.next_air_date <= current_date + 21;
    UPDATE public.watchlist w SET status = 'watching'
    WHERE w.media_type = 'tv' AND w.tmdb_id = NEW.tmdb_id AND w.status = 'completed'
      AND (
        (SELECT count(*) FROM public.watched_episodes e
          WHERE e.user_id = w.user_id AND e.tmdb_id = w.tmdb_id AND e.season_number > 0)
          BETWEEN 1 AND CASE WHEN airing THEN 2147483647 ELSE NEW.episode_count_aired - 1 END
      );
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.reopen_completed_shows() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS media_cache_reopen_completed ON public.media_cache;
CREATE TRIGGER media_cache_reopen_completed
AFTER INSERT OR UPDATE OF episode_count_aired, next_air_date ON public.media_cache
FOR EACH ROW EXECUTE FUNCTION public.reopen_completed_shows();