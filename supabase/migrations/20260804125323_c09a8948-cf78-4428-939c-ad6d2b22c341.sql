CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  follows boolean NOT NULL DEFAULT true,
  new_episodes boolean NOT NULL DEFAULT true,
  new_releases boolean NOT NULL DEFAULT true,
  moderation boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
ON public.notification_preferences FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_preferences_set_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_uidx
  ON public.notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wants boolean;
  actor_name text;
  actor_username text;
BEGIN
  SELECT COALESCE(p.follows, true) INTO wants
  FROM (SELECT 1) x
  LEFT JOIN public.notification_preferences p ON p.user_id = NEW.following_id;
  IF wants IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username), username
    INTO actor_name, actor_username
  FROM public.profiles WHERE id = NEW.follower_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, dedupe_key)
  VALUES (
    NEW.following_id,
    'follow',
    'New follower',
    COALESCE(actor_name, 'Someone') || ' started following you',
    CASE WHEN actor_username IS NOT NULL THEN '/u/' || actor_username ELSE NULL END,
    'follow:' || NEW.follower_id::text
  )
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER follows_notify
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();