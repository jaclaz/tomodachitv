CREATE TABLE public.user_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  tmdb_id integer NOT NULL,
  rating numeric(2,1) NOT NULL CHECK (rating >= 0.5 AND rating <= 5 AND (rating * 2) = floor(rating * 2)),
  title text,
  poster_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_type, tmdb_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ratings TO authenticated;
GRANT ALL ON public.user_ratings TO service_role;

ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ratings"
  ON public.user_ratings FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Followers can read ratings"
  ON public.user_ratings FOR SELECT TO authenticated
  USING (public.is_follower(auth.uid(), user_id));

CREATE TRIGGER user_ratings_set_updated_at
  BEFORE UPDATE ON public.user_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();