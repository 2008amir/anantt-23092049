-- Allow password_reset purpose in auth_email_codes
ALTER TABLE public.auth_email_codes DROP CONSTRAINT IF EXISTS auth_email_codes_purpose_check;
ALTER TABLE public.auth_email_codes ADD CONSTRAINT auth_email_codes_purpose_check
  CHECK (purpose IN ('signup', 'device_verify', 'order_confirm', 'password_reset'));

-- Login attempts log for rate-limiting and security telemetry
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  ip text,
  user_agent text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_email_created_idx
  ON public.login_attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_ip_created_idx
  ON public.login_attempts (ip, created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Login attempts admin select"
  ON public.login_attempts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));