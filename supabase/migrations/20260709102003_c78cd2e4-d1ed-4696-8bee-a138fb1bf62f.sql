CREATE TABLE public.list_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.user_lists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, list_id)
);

GRANT SELECT, INSERT, DELETE ON public.list_saves TO authenticated;
GRANT ALL ON public.list_saves TO service_role;

ALTER TABLE public.list_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read saves on visible lists"
  ON public.list_saves FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_lists l
      WHERE l.id = list_saves.list_id
        AND (l.is_public = true OR l.user_id = auth.uid())
    )
  );

CREATE POLICY "save public lists (not own)"
  ON public.list_saves FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_lists l
      WHERE l.id = list_saves.list_id
        AND l.is_public = true
        AND l.user_id <> auth.uid()
    )
  );

CREATE POLICY "unsave own"
  ON public.list_saves FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX list_saves_list_id_idx ON public.list_saves(list_id);
CREATE INDEX list_saves_user_id_idx ON public.list_saves(user_id);