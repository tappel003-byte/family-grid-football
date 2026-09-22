-- League rules (roster limits, waiver settings, trade deadline)
ALTER TABLE public.league ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Trades between two teams
CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.league(id) ON DELETE CASCADE,
  from_slot integer NOT NULL,
  to_slot integer NOT NULL,
  from_team_name text NOT NULL DEFAULT '',
  to_team_name text NOT NULL DEFAULT '',
  from_player_ids text[] NOT NULL DEFAULT '{}',
  to_player_ids text[] NOT NULL DEFAULT '{}',
  from_player_names text[] NOT NULL DEFAULT '{}',
  to_player_names text[] NOT NULL DEFAULT '{}',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  week integer NOT NULL DEFAULT 1,
  proposer_id uuid,
  proposer_name text NOT NULL DEFAULT '',
  resolver_id uuid,
  resolver_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

GRANT SELECT ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can read trades"
  ON public.trades FOR SELECT TO authenticated USING (true);

-- Commissioner score corrections
CREATE TABLE public.score_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.league(id) ON DELETE CASCADE,
  week integer NOT NULL,
  team_slot integer NOT NULL,
  points numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (league_id, week, team_slot)
);

GRANT SELECT ON public.score_overrides TO authenticated;
GRANT ALL ON public.score_overrides TO service_role;
ALTER TABLE public.score_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can read score corrections"
  ON public.score_overrides FOR SELECT TO authenticated USING (true);