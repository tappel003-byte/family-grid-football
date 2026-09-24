CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.waiver_run_token (
  id integer PRIMARY KEY DEFAULT 1,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex')
);
GRANT ALL ON public.waiver_run_token TO service_role;
ALTER TABLE public.waiver_run_token ENABLE ROW LEVEL SECURITY;
INSERT INTO public.waiver_run_token (id) VALUES (1);

-- Wednesday 04:00 and 05:00 UTC: one of these is midnight Eastern depending on daylight saving.
SELECT cron.schedule(
  'weekly-waiver-run',
  '1 4,5 * * 3',
  $$
  SELECT net.http_post(
    url := 'https://project--9e6d3f1b-c552-4593-bbf5-0683a61227a0.lovable.app/api/public/run-waivers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT token FROM public.waiver_run_token WHERE id = 1)
    ),
    body := '{}'::jsonb
  );
  $$
);