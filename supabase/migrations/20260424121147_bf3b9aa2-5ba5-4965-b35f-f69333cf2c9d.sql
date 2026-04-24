-- Device fingerprint tracking to prevent referral abuse
CREATE TABLE IF NOT EXISTS public.referral_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  ip text,
  user_agent text,
  platform text,
  hardware jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_devices_user_idx ON public.referral_devices(user_id);

ALTER TABLE public.referral_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referral devices admin all"
  ON public.referral_devices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Referral devices owner insert"
  ON public.referral_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Referral devices owner select"
  ON public.referral_devices FOR SELECT
  USING (auth.uid() = user_id);

-- Add first_name / last_name / country columns to profiles if not present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS country text;

-- Update attach_referral_on_signup to dedupe by device fingerprint
CREATE OR REPLACE FUNCTION public.attach_referral_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  code text;
  fp text;
  enrollment record;
  dup boolean;
BEGIN
  code := NEW.raw_user_meta_data->>'ref';
  fp := NEW.raw_user_meta_data->>'device_fp';

  -- Persist first/last name/country if provided on signup metadata
  UPDATE public.profiles
  SET
    first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', first_name),
    last_name  = COALESCE(NEW.raw_user_meta_data->>'last_name', last_name),
    country    = COALESCE(NEW.raw_user_meta_data->>'country', country)
  WHERE id = NEW.id;

  IF code IS NULL OR code = '' THEN
    RETURN NEW;
  END IF;

  -- Store code on profile for audit
  UPDATE public.profiles SET referred_by_code = code WHERE id = NEW.id;

  -- Device dedupe: if this fingerprint already registered ANY user, skip referral credit
  dup := false;
  IF fp IS NOT NULL AND fp <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.referral_devices WHERE fingerprint = fp
    ) INTO dup;
  END IF;

  IF dup THEN
    RETURN NEW;
  END IF;

  -- Find an active enrollment for this code
  SELECT e.id, e.user_id, e.reward_id INTO enrollment
  FROM public.reward_enrollments e
  WHERE e.referral_code = code
    AND e.status = 'active'
    AND (e.expires_at IS NULL OR e.expires_at > now())
  LIMIT 1;

  IF enrollment.id IS NOT NULL AND enrollment.user_id <> NEW.id THEN
    INSERT INTO public.referrals (enrollment_id, referrer_user_id, referred_user_id)
    VALUES (enrollment.id, enrollment.user_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;