
-- Deliverers: remove public read; allow admins + authenticated deliverers
DROP POLICY IF EXISTS "Deliverers public read" ON public.deliverers;

CREATE POLICY "Deliverers admin read"
  ON public.deliverers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deliverers self read"
  ON public.deliverers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Deliverers role read"
  ON public.deliverers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'deliverer'::app_role));

-- signup_verifications: remove client-readable admin policy; only service role accesses
DROP POLICY IF EXISTS "Admins can view signup verifications" ON public.signup_verifications;

-- Revoke direct EXECUTE from anon on has_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
