CREATE TABLE public.signup_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password text NOT NULL,
  first_name text,
  last_name text,
  display_name text,
  country text,
  referral_code text,
  device_fp text,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed boolean NOT NULL DEFAULT false,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signup_verifications_email ON public.signup_verifications (lower(email));

ALTER TABLE public.signup_verifications ENABLE ROW LEVEL SECURITY;

-- No public policies — only service role (server functions) may read/write.
CREATE POLICY "Admins can view signup verifications"
ON public.signup_verifications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));