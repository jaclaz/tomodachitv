DROP INDEX IF EXISTS public.pending_media_imports_unique_idx;

UPDATE public.pending_media_imports SET season_number = -1 WHERE season_number IS NULL;
UPDATE public.pending_media_imports SET episode_number = -1 WHERE episode_number IS NULL;

ALTER TABLE public.pending_media_imports
  ALTER COLUMN season_number SET DEFAULT -1,
  ALTER COLUMN season_number SET NOT NULL,
  ALTER COLUMN episode_number SET DEFAULT -1,
  ALTER COLUMN episode_number SET NOT NULL;

ALTER TABLE public.pending_media_imports
  ADD CONSTRAINT pending_media_imports_unique
  UNIQUE (user_id, kind, source, source_id, season_number, episode_number);