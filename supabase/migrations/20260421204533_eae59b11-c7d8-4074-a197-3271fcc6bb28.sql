-- Admin role bootstrap for fatimamustaphaabdu@gmail.com
-- Will be assigned on first login via app code

-- Deliverers table
CREATE TABLE public.deliverers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  state text NOT NULL,
  city text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deliverers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deliverers admin all"
  ON public.deliverers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Deliverers public read"
  ON public.deliverers FOR SELECT
  USING (true);

-- Order delivery assignments (links order -> deliverer + status)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deliverer_id uuid REFERENCES public.deliverers(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_stage text NOT NULL DEFAULT 'pending';
-- delivery_stage: pending | assigned | in_transit | delivered

-- Allow admins to update orders (assigning deliverer, marking delivered)
CREATE POLICY "Orders admin update"
  ON public.orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Orders admin select"
  ON public.orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Messages table (user <-> admin)
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sender text NOT NULL CHECK (sender IN ('user', 'admin')),
  body text NOT NULL,
  read_by_admin boolean NOT NULL DEFAULT false,
  read_by_user boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages owner select"
  ON public.messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Messages owner insert"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND sender = 'user');

CREATE POLICY "Messages admin all"
  ON public.messages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_messages_user_created ON public.messages(user_id, created_at DESC);

-- Delivery prices per LGA
CREATE TABLE public.lga_delivery_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  lga text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(state, lga)
);
ALTER TABLE public.lga_delivery_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "LGA prices public read"
  ON public.lga_delivery_prices FOR SELECT
  USING (true);

CREATE POLICY "LGA prices admin all"
  ON public.lga_delivery_prices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admin to read all profiles for Users page
CREATE POLICY "Profiles admin select"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admin to read all addresses
CREATE POLICY "Addresses admin select"
  ON public.addresses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admin to read order items
CREATE POLICY "Order items admin select"
  ON public.order_items FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed a few sample deliverers
INSERT INTO public.deliverers (name, phone, state, city) VALUES
  ('Musa Ibrahim', '+2348012345678', 'Lagos', 'Ikeja'),
  ('Aisha Bello', '+2348023456789', 'Lagos', 'Lekki'),
  ('Chuka Okeke', '+2348034567890', 'Abuja', 'Wuse'),
  ('Fatima Sani', '+2348045678901', 'Kano', 'Nasarawa'),
  ('Tunde Adeyemi', '+2348056789012', 'Rivers', 'Port Harcourt');
