-- Optional plain-English reason when a waiver claim loses (additive; existing rows stay null).
ALTER TABLE public.waiver_claims
  ADD COLUMN IF NOT EXISTS loss_reason text NOT NULL DEFAULT '';
