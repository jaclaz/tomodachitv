ALTER TABLE public.watchlist DROP CONSTRAINT IF EXISTS watchlist_status_check;
ALTER TABLE public.watchlist ADD CONSTRAINT watchlist_status_check CHECK (status IN ('planned', 'watching', 'caught_up', 'completed', 'dropped'));
ALTER TABLE public.watchlist ALTER COLUMN status SET DEFAULT 'planned';