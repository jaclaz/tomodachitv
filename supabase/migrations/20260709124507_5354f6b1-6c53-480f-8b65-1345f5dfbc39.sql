CREATE UNIQUE INDEX IF NOT EXISTS pending_media_imports_unique_idx
ON public.pending_media_imports (
  user_id, kind, source, source_id,
  COALESCE(season_number, -1),
  COALESCE(episode_number, -1)
);