-- Auto-saved final scores for each finished week (season rollover + record book)
CREATE TABLE public.weekly_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.league(id) ON DELETE CASCADE,
  week integer NOT NULL,
  team_slot integer NOT NULL,
  points numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (league_id, week, team_slot)
);

GRANT SELECT ON public.weekly_results TO authenticated;
GRANT ALL ON public.weekly_results TO service_role;
ALTER TABLE public.weekly_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can read weekly results"
  ON public.weekly_results FOR SELECT TO authenticated USING (true);

-- Waiver claims: pending pickups that process in claiming order
CREATE TABLE public.waiver_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.league(id) ON DELETE CASCADE,
  team_slot integer NOT NULL,
  team_name text NOT NULL DEFAULT '',
  player_id text NOT NULL,
  player_name text NOT NULL DEFAULT '',
  player_pos text NOT NULL DEFAULT '',
  player_team text NOT NULL DEFAULT '',
  drop_player_id text,
  drop_player_name text NOT NULL DEFAULT '',
  week integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  actor_id uuid,
  actor_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiver_claims TO authenticated;
GRANT ALL ON public.waiver_claims TO service_role;
ALTER TABLE public.waiver_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can read waiver claims"
  ON public.waiver_claims FOR SELECT TO authenticated USING (true);
