ALTER TABLE public.profiles
ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'America/Denver';

COMMENT ON COLUMN public.profiles.time_zone IS 'IANA time zone used to display NFL kickoff times for this family member.';