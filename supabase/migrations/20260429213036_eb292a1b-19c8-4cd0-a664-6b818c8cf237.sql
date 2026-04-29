-- Table to store verification links sent via Brevo
CREATE TABLE public.email_verification_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  action_link text NOT NULL,
  purpose text NOT NULL DEFAULT 'verify',
  consumed boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE INDEX idx_evl_token ON public.email_verification_links(token_hash);
CREATE INDEX idx_evl_email ON public.email_verification_links(email);

ALTER TABLE public.email_verification_links ENABLE ROW LEVEL SECURITY;

-- No client access; only service role (server) reads/writes.
CREATE POLICY "Admins can view verification links"
ON public.email_verification_links
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));