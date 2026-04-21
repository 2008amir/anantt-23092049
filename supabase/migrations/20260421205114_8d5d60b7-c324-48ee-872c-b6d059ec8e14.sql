-- Extend products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_price numeric,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Admin write policies on products
DROP POLICY IF EXISTS "Products admin insert" ON public.products;
DROP POLICY IF EXISTS "Products admin update" ON public.products;
DROP POLICY IF EXISTS "Products admin delete" ON public.products;

CREATE POLICY "Products admin insert" ON public.products
  FOR INSERT TO public
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Products admin update" ON public.products
  FOR UPDATE TO public
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Products admin delete" ON public.products
  FOR DELETE TO public
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
DROP POLICY IF EXISTS "Product images admin insert" ON storage.objects;
DROP POLICY IF EXISTS "Product images admin update" ON storage.objects;
DROP POLICY IF EXISTS "Product images admin delete" ON storage.objects;

CREATE POLICY "Product images public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

CREATE POLICY "Product images admin insert" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Product images admin update" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Product images admin delete" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

-- Enable realtime on messages for live chat
ALTER TABLE public.messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
END $$;