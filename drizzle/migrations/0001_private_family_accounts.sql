-- Roles
CREATE TYPE public.app_role AS ENUM ('commissioner', 'member');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see the family directory"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "People can update their own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see who holds which role"
ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- New accounts: first person to sign in becomes commissioner, everyone else is a member.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_commish BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(COALESCE(NEW.email, ''), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'commissioner') INTO has_commish;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN has_commish THEN 'member'::public.app_role ELSE 'commissioner'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Team ownership
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS user_id UUID;

-- League data becomes family-only
DROP POLICY IF EXISTS "League is readable by everyone" ON public.league;
DROP POLICY IF EXISTS "Teams are readable by everyone" ON public.teams;
DROP POLICY IF EXISTS "History is readable by everyone" ON public.season_history;

REVOKE ALL ON public.league FROM anon;
REVOKE ALL ON public.teams FROM anon;
REVOKE ALL ON public.season_history FROM anon;

GRANT SELECT ON public.league TO authenticated;
GRANT SELECT ON public.teams TO authenticated;
GRANT SELECT ON public.season_history TO authenticated;

CREATE POLICY "Family members can read the league"
ON public.league FOR SELECT TO authenticated USING (true);

CREATE POLICY "Family members can read teams"
ON public.teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Family members can read history"
ON public.season_history FOR SELECT TO authenticated USING (true);
