CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER notifications_set_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profile_reports ADD COLUMN IF NOT EXISTS action_taken text;

ALTER TABLE public.profile_reports DROP CONSTRAINT IF EXISTS profile_reports_status_check;
ALTER TABLE public.profile_reports ADD CONSTRAINT profile_reports_status_check
  CHECK (status = ANY (ARRAY['pending', 'reviewed', 'actioned', 'dismissed']));

UPDATE public.profile_reports SET status = 'actioned' WHERE status = 'reviewed';

ALTER TABLE public.profile_reports DROP CONSTRAINT IF EXISTS profile_reports_status_check;
ALTER TABLE public.profile_reports ADD CONSTRAINT profile_reports_status_check
  CHECK (status = ANY (ARRAY['pending', 'actioned', 'dismissed']));