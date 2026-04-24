-- Extend rewards table into task-based system
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS referral_goal integer,
  ADD COLUMN IF NOT EXISTS expires_hours integer,
  ADD COLUMN IF NOT EXISTS reward_price numeric,
  ADD COLUMN IF NOT EXISTS product_amount integer,
  ADD COLUMN IF NOT EXISTS require_purchase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_percent integer,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Validate task_type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rewards_task_type_check'
  ) THEN
    ALTER TABLE public.rewards
      ADD CONSTRAINT rewards_task_type_check
      CHECK (task_type IN ('legacy','referral','purchase'));
  END IF;
END $$;

-- Pinned products for a reward task (optional). If none pinned, users pick any
-- product with price <= reward_price.
CREATE TABLE IF NOT EXISTS public.reward_task_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reward_id, product_id)
);

ALTER TABLE public.reward_task_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reward products public read" ON public.reward_task_products
  FOR SELECT USING (true);

CREATE POLICY "Reward products admin write" ON public.reward_task_products
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User enrollments in a reward task
CREATE TABLE IF NOT EXISTS public.reward_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_id uuid NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  completed_at timestamptz,
  claimed_product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  claimed_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_id)
);

CREATE INDEX IF NOT EXISTS idx_reward_enrollments_user ON public.reward_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_enrollments_code ON public.reward_enrollments(referral_code);

ALTER TABLE public.reward_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enrollments owner select" ON public.reward_enrollments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Enrollments owner insert" ON public.reward_enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enrollments owner update" ON public.reward_enrollments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enrollments admin all" ON public.reward_enrollments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Referrals: records a referred user who signed up via a referral_code
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.reward_enrollments(id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  has_purchased boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_enrollment ON public.referrals(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_user_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrals referrer select" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id);

CREATE POLICY "Referrals admin all" ON public.referrals
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Track pending referral code on profile (captured from ?ref= before signup)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_code text;

-- Trigger to create a referral row on signup if user has a referred_by_code
CREATE OR REPLACE FUNCTION public.attach_referral_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
  enrollment record;
BEGIN
  code := NEW.raw_user_meta_data->>'ref';
  IF code IS NULL OR code = '' THEN
    RETURN NEW;
  END IF;

  -- Store code on profile for audit
  UPDATE public.profiles SET referred_by_code = code WHERE id = NEW.id;

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

DROP TRIGGER IF EXISTS on_auth_user_created_attach_referral ON auth.users;
CREATE TRIGGER on_auth_user_created_attach_referral
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.attach_referral_on_signup();

-- When an order is marked paid, flip has_purchased for any referrals of that user
CREATE OR REPLACE FUNCTION public.mark_referral_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    UPDATE public.referrals
    SET has_purchased = true
    WHERE referred_user_id = NEW.user_id AND has_purchased = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_paid_mark_referral ON public.orders;
CREATE TRIGGER on_order_paid_mark_referral
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.mark_referral_purchase();