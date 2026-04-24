ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS variant jsonb;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant jsonb;