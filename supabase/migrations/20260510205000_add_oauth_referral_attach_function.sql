-- Attach referral codes captured in browser storage after OAuth signups.
CREATE OR REPLACE FUNCTION public.attach_referral_after_oauth_signup(
  code text,
  device_fp text DEFAULT NULL,
  device_ip text DEFAULT NULL,
  device_user_agent text DEFAULT NULL,
  device_platform text DEFAULT NULL,
  device_hardware jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid;
  normalized_code text;
  existing_code text;
  created_at_ts timestamptz;
  enrollment record;
  dup boolean;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  normalized_code := upper(trim(coalesce(code, '')));
  IF normalized_code = '' OR normalized_code !~ '^[A-Z0-9]{4,16}$' THEN
    RETURN false;
  END IF;

  SELECT p.referred_by_code INTO existing_code
  FROM public.profiles p
  WHERE p.id = uid;

  IF existing_code IS NOT NULL AND existing_code <> '' THEN
    RETURN true;
  END IF;

  SELECT u.created_at INTO created_at_ts
  FROM auth.users u
  WHERE u.id = uid;

  -- Only attach this browser-captured code during fresh signup windows.
  IF created_at_ts IS NULL OR created_at_ts < now() - interval '30 minutes' THEN
    RETURN true;
  END IF;

  UPDATE public.profiles
  SET referred_by_code = normalized_code
  WHERE id = uid;

  dup := false;
  IF device_fp IS NOT NULL AND device_fp <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.referral_devices d
      WHERE d.fingerprint = device_fp
        AND d.user_id <> uid
    ) INTO dup;

    INSERT INTO public.referral_devices (fingerprint, user_id, ip, user_agent, platform, hardware)
    VALUES (device_fp, uid, device_ip, device_user_agent, device_platform, device_hardware)
    ON CONFLICT (fingerprint) DO NOTHING;
  END IF;

  IF dup THEN
    RETURN true;
  END IF;

  SELECT e.id, e.user_id INTO enrollment
  FROM public.reward_enrollments e
  WHERE e.referral_code = normalized_code
    AND e.status = 'active'
    AND (e.expires_at IS NULL OR e.expires_at > now())
  LIMIT 1;

  IF enrollment.id IS NOT NULL AND enrollment.user_id <> uid THEN
    INSERT INTO public.referrals (enrollment_id, referrer_user_id, referred_user_id)
    VALUES (enrollment.id, enrollment.user_id, uid)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_referral_after_oauth_signup(text, text, text, text, text, jsonb) TO authenticated;
