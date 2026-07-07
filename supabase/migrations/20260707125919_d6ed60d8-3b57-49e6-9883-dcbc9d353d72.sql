INSERT INTO public.user_roles (user_id, role) VALUES
  ('fbc25bf4-5cbd-444d-a219-e719a0758d1e', 'admin'),
  ('495168c0-4042-46e0-a728-449fd103631d', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;