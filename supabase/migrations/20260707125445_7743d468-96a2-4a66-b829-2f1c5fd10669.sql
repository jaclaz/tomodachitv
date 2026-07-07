-- Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Reports
CREATE TABLE IF NOT EXISTS public.profile_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user','auto_moderation')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (reporter_id <> reported_user_id OR source = 'auto_moderation')
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_reports_unique_pending
  ON public.profile_reports (reporter_id, reported_user_id)
  WHERE status = 'pending' AND source = 'user';

CREATE INDEX IF NOT EXISTS profile_reports_status_idx ON public.profile_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_reports_reported_idx ON public.profile_reports (reported_user_id);

GRANT SELECT, INSERT, UPDATE ON public.profile_reports TO authenticated;
GRANT ALL ON public.profile_reports TO service_role;
ALTER TABLE public.profile_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users create reports" ON public.profile_reports;
CREATE POLICY "Users create reports"
  ON public.profile_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND reported_user_id <> auth.uid()
    AND source = 'user'
  );

DROP POLICY IF EXISTS "Reporter or admin can view" ON public.profile_reports;
CREATE POLICY "Reporter or admin can view"
  ON public.profile_reports FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admins update reports" ON public.profile_reports;
CREATE POLICY "Admins update reports"
  ON public.profile_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));