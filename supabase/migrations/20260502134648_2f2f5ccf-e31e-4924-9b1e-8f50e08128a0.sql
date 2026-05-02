-- Add columns needed to manage device verification OTP cooldown via auth_email_codes
ALTER TABLE public.auth_email_codes
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS auth_email_codes_email_purpose_idx
  ON public.auth_email_codes (email, purpose, used, created_at DESC);

-- Ensure RLS is enabled (no public policies — only service role accesses it)
ALTER TABLE public.auth_email_codes ENABLE ROW LEVEL SECURITY;