CREATE TABLE public.player_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  league_id uuid NOT NULL REFERENCES public.league(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, league_id, player_id)
);
GRANT SELECT, INSERT, DELETE ON public.player_watchlist TO authenticated;
GRANT ALL ON public.player_watchlist TO service_role;
ALTER TABLE public.player_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "People can see their own watchlist"
ON public.player_watchlist FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "People can add to their own watchlist"
ON public.player_watchlist FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "People can remove from their own watchlist"
ON public.player_watchlist FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.trade_block (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.league(id) ON DELETE CASCADE,
  team_slot integer NOT NULL,
  user_id uuid NOT NULL,
  player_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, player_id)
);
GRANT SELECT, INSERT, DELETE ON public.trade_block TO authenticated;
GRANT ALL ON public.trade_block TO service_role;
ALTER TABLE public.trade_block ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can see the trade block"
ON public.trade_block FOR SELECT TO authenticated
USING (true);
CREATE POLICY "Owners can add their players to the trade block"
ON public.trade_block FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.teams
    WHERE teams.league_id = trade_block.league_id
      AND teams.slot = trade_block.team_slot
      AND teams.user_id = auth.uid()
      AND trade_block.player_id = ANY(
        ARRAY(
          SELECT jsonb_array_elements_text(
            COALESCE(teams.starters, '[]'::jsonb) || COALESCE(teams.bench, '[]'::jsonb)
          )
        )
      )
  )
);
CREATE POLICY "Owners can remove their players from the trade block"
ON public.trade_block FOR DELETE TO authenticated
USING (auth.uid() = user_id);