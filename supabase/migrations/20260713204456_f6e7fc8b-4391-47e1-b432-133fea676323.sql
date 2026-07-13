
-- Add status to watchlist entries
ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS status text
    CHECK (status IN ('watching','caught_up','completed','dropped'));

CREATE INDEX IF NOT EXISTS watchlist_user_status_idx
  ON public.watchlist (user_id, status);

-- Extend media cache with fields required to compute a series status
ALTER TABLE public.media_cache
  ADD COLUMN IF NOT EXISTS series_status text,
  ADD COLUMN IF NOT EXISTS episode_count_aired integer,
  ADD COLUMN IF NOT EXISTS next_air_date date;
