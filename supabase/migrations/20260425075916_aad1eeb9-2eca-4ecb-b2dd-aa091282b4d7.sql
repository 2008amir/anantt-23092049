CREATE TABLE public.auth_email_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('verify', 'reset')),
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_email_codes_email_purpose ON public.auth_email_codes (lower(email), purpose, created_at DESC);

ALTER TABLE public.auth_email_codes ENABLE ROW LEVEL SECURITY;

-- No policies = only service role can access. Users never touch this table directly.