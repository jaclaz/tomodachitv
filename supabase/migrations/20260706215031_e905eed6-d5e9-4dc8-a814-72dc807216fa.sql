
-- Favorites: per-user liked movies/series
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  tmdb_id integer NOT NULL,
  title text NOT NULL,
  poster_path text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_type, tmdb_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites all" ON public.favorites FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public read favorites of followed or self" ON public.favorites FOR SELECT
  USING (auth.uid() = user_id OR public.is_follower(auth.uid(), user_id));
CREATE INDEX favorites_user_added_idx ON public.favorites (user_id, added_at DESC);

-- User lists
CREATE TABLE public.user_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lists TO authenticated;
GRANT ALL ON public.user_lists TO service_role;
ALTER TABLE public.user_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lists all" ON public.user_lists FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public lists readable" ON public.user_lists FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);
CREATE INDEX user_lists_user_idx ON public.user_lists (user_id, updated_at DESC);

-- User list items
CREATE TABLE public.user_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.user_lists(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('movie','tv')),
  tmdb_id integer NOT NULL,
  title text NOT NULL,
  poster_path text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, media_type, tmdb_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_list_items TO authenticated;
GRANT ALL ON public.user_list_items TO service_role;
ALTER TABLE public.user_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list items follow parent" ON public.user_list_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_lists l WHERE l.id = list_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_lists l WHERE l.id = list_id AND l.user_id = auth.uid()));
CREATE POLICY "public list items readable" ON public.user_list_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_lists l WHERE l.id = list_id AND (l.is_public = true OR l.user_id = auth.uid())));
CREATE INDEX user_list_items_list_idx ON public.user_list_items (list_id, added_at DESC);

-- updated_at trigger for user_lists
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER user_lists_set_updated_at BEFORE UPDATE ON public.user_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
