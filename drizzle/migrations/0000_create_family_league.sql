CREATE TABLE public.league (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE DEFAULT 'main',
  name text NOT NULL DEFAULT 'La Familia Fantasy Football',
  current_week integer NOT NULL DEFAULT 1,
  scoring jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.league TO anon;
GRANT SELECT, INSERT, UPDATE ON public.league TO authenticated;
GRANT ALL ON public.league TO service_role;
ALTER TABLE public.league ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League is readable by everyone" ON public.league FOR SELECT USING (true);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.league(id) ON DELETE CASCADE,
  slot integer NOT NULL,
  name text NOT NULL DEFAULT 'New Team',
  owner text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#1d4ed8',
  starters jsonb NOT NULL DEFAULT '[]'::jsonb,
  bench jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, slot)
);

GRANT SELECT ON public.teams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams are readable by everyone" ON public.teams FOR SELECT USING (true);

CREATE TABLE public.season_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season integer NOT NULL UNIQUE,
  champion text NOT NULL DEFAULT '',
  champion_owner text NOT NULL DEFAULT '',
  runner_up text NOT NULL DEFAULT '',
  runner_up_owner text NOT NULL DEFAULT '',
  regular_season_best text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  standings jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.season_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_history TO authenticated;
GRANT ALL ON public.season_history TO service_role;
ALTER TABLE public.season_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "History is readable by everyone" ON public.season_history FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.league;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.season_history;