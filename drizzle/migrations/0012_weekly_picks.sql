CREATE TABLE public.game_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  season text NOT NULL,
  week integer NOT NULL,
  game_id text NOT NULL,
  team text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, season, week, game_id)
);
GRANT SELECT ON public.game_picks TO authenticated;
GRANT ALL ON public.game_picks TO service_role;
ALTER TABLE public.game_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See your own picks" ON public.game_picks FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.pick_tiebreakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  season text NOT NULL,
  week integer NOT NULL,
  total_points integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, season, week)
);
GRANT SELECT ON public.pick_tiebreakers TO authenticated;
GRANT ALL ON public.pick_tiebreakers TO service_role;
ALTER TABLE public.pick_tiebreakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See your own tiebreaker" ON public.pick_tiebreakers FOR SELECT TO authenticated USING (auth.uid() = user_id);