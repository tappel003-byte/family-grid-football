CREATE OR REPLACE FUNCTION public.is_league_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('member','commissioner'))
$$;

DROP POLICY IF EXISTS "Family members can read trades" ON public.trades;
CREATE POLICY "Family members can read trades" ON public.trades FOR SELECT TO authenticated USING (public.is_league_member(auth.uid()));
DROP POLICY IF EXISTS "Family members can read waiver claims" ON public.waiver_claims;
CREATE POLICY "Family members can read waiver claims" ON public.waiver_claims FOR SELECT TO authenticated USING (public.is_league_member(auth.uid()));
DROP POLICY IF EXISTS "Family can read chat" ON public.chat_messages;
CREATE POLICY "Family can read chat" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_league_member(auth.uid()));
DROP POLICY IF EXISTS "Family members can read weekly results" ON public.weekly_results;
CREATE POLICY "Family members can read weekly results" ON public.weekly_results FOR SELECT TO authenticated USING (public.is_league_member(auth.uid()));
DROP POLICY IF EXISTS "Family members can read score corrections" ON public.score_overrides;
CREATE POLICY "Family members can read score corrections" ON public.score_overrides FOR SELECT TO authenticated USING (public.is_league_member(auth.uid()));
DROP POLICY IF EXISTS "Family members can see the trade block" ON public.trade_block;
CREATE POLICY "Family members can see the trade block" ON public.trade_block FOR SELECT TO authenticated USING (public.is_league_member(auth.uid()));