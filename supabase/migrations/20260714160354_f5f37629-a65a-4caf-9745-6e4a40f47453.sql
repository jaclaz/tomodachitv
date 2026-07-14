
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned';

-- Backfill tv shows currently being watched
UPDATE public.watchlist w SET status = 'watching'
  WHERE media_type = 'tv' AND status = 'planned' AND EXISTS (
    SELECT 1 FROM public.watched_episodes we
    WHERE we.user_id = w.user_id AND we.tmdb_id = w.tmdb_id
  );

-- Backfill completed tv shows (watched >= aired)
UPDATE public.watchlist w SET status = 'completed'
  WHERE media_type = 'tv' AND status <> 'dropped' AND EXISTS (
    SELECT 1 FROM public.media_cache mc
    WHERE mc.media_type = 'tv' AND mc.tmdb_id = w.tmdb_id
      AND mc.episode_count_aired IS NOT NULL AND mc.episode_count_aired > 0
      AND (SELECT count(*) FROM public.watched_episodes we
           WHERE we.user_id = w.user_id AND we.tmdb_id = w.tmdb_id) >= mc.episode_count_aired
  );

-- Ensure every watched movie has a completed library entry
INSERT INTO public.watchlist (user_id, tmdb_id, media_type, series_name, status)
  SELECT wm.user_id, wm.tmdb_id, 'movie', COALESCE(wm.title, 'Movie'), 'completed'
  FROM public.watched_movies wm
  WHERE NOT EXISTS (
    SELECT 1 FROM public.watchlist w
    WHERE w.user_id = wm.user_id AND w.media_type = 'movie' AND w.tmdb_id = wm.tmdb_id
  );

UPDATE public.watchlist w SET status = 'completed'
  WHERE media_type = 'movie' AND status <> 'completed' AND EXISTS (
    SELECT 1 FROM public.watched_movies wm
    WHERE wm.user_id = w.user_id AND wm.tmdb_id = w.tmdb_id
  );
