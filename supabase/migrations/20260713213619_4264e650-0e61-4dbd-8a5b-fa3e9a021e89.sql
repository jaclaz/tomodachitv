
CREATE TABLE public.dropped_shows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  dropped_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, tmdb_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dropped_shows TO authenticated;
GRANT ALL ON public.dropped_shows TO service_role;

ALTER TABLE public.dropped_shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dropped shows"
  ON public.dropped_shows
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
