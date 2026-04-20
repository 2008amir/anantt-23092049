-- Saved payment methods (cards) - we ONLY store metadata + Paystack auth code, never raw PAN/CVV
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brand TEXT NOT NULL,
  last4 TEXT NOT NULL,
  exp_month TEXT NOT NULL,
  exp_year TEXT NOT NULL,
  card_holder TEXT NOT NULL,
  authorization_code TEXT,
  paystack_customer_code TEXT,
  email TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment methods owner select" ON public.payment_methods
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Payment methods owner insert" ON public.payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Payment methods owner update" ON public.payment_methods
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Payment methods owner delete" ON public.payment_methods
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add payment columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';