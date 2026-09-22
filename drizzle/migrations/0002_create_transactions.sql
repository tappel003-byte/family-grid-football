CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.league(id) ON DELETE CASCADE,
  team_slot INTEGER NOT NULL,
  team_name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'add',
  added_player_id TEXT,
  added_player_name TEXT NOT NULL DEFAULT '',
  dropped_player_id TEXT,
  dropped_player_name TEXT NOT NULL DEFAULT '',
  actor_id UUID,
  actor_name TEXT NOT NULL DEFAULT '',
  week INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transactions_league_created_idx ON public.transactions (league_id, created_at DESC);
CREATE UNIQUE INDEX transactions_added_once_idx ON public.transactions (league_id, added_player_id, created_at);

GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can read the activity feed"
ON public.transactions FOR SELECT TO authenticated USING (true);