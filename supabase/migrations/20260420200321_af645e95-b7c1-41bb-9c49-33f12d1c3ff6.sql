-- User interest tracking (views + searches)
CREATE TABLE public.user_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('view', 'search')),
  product_id text,
  query text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_interests_user_created ON public.user_interests(user_id, created_at DESC);

ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interests owner select" ON public.user_interests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Interests owner insert" ON public.user_interests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Interests owner delete" ON public.user_interests
  FOR DELETE USING (auth.uid() = user_id);

-- Roles (for admin reward management)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Roles self select" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Rewards
CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image text,
  points integer NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rewards public read" ON public.rewards FOR SELECT USING (true);
CREATE POLICY "Rewards admin insert" ON public.rewards FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Rewards admin update" ON public.rewards FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Rewards admin delete" ON public.rewards FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));