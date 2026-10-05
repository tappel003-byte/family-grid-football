-- Freeze scoring lineups when a week rolls off, and serialize background jobs.
-- Additive: existing seasons keep working; past weeks without a freeze fall back to live starters.

CREATE TABLE IF NOT EXISTS public.weekly_lineups (
  league_id uuid NOT NULL REFERENCES public.league(id) ON DELETE CASCADE,
  week integer NOT NULL,
  team_slot integer NOT NULL,
  starters jsonb NOT NULL DEFAULT '[]'::jsonb,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, week, team_slot)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_lineups TO authenticated;
GRANT ALL ON public.weekly_lineups TO service_role;
ALTER TABLE public.weekly_lineups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Family members can read weekly lineups" ON public.weekly_lineups;
CREATE POLICY "Family members can read weekly lineups"
  ON public.weekly_lineups FOR SELECT TO authenticated
  USING (public.is_league_member(auth.uid()));

ALTER TABLE public.league
  ADD COLUMN IF NOT EXISTS job_lock text,
  ADD COLUMN IF NOT EXISTS job_lock_until timestamptz;

-- Tuesday ~12:15 AM Eastern (04:15 UTC): roll the week and freeze lineups before Wednesday waivers.
-- Uses the same token host as the waiver cron (Lovable URL today; update when Cloudflare hosts).
DO $$
BEGIN
  PERFORM cron.unschedule('weekly-roll-week');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'weekly-roll-week',
  '15 4 * * 2',
  $$
  SELECT net.http_post(
    url := 'https://project--9e6d3f1b-c552-4593-bbf5-0683a61227a0.lovable.app/api/public/roll-week',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT token FROM public.waiver_run_token WHERE id = 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
