CREATE TABLE public.rewatches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('tv','movie')),
  tmdb_id INTEGER NOT NULL,
  title TEXT,
  poster_path TEXT,
  episodes_count INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX rewatches_user_media_idx ON public.rewatches (user_id, media_type, tmdb_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewatches TO authenticated;
GRANT ALL ON public.rewatches TO service_role;

ALTER TABLE public.rewatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own rewatches"
ON public.rewatches FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);