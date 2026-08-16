CREATE TABLE public.recommendation_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type text NOT NULL,
  tmdb_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_type, tmdb_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_dismissals TO authenticated;
GRANT ALL ON public.recommendation_dismissals TO service_role;
ALTER TABLE public.recommendation_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recommendation dismissals" ON public.recommendation_dismissals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);