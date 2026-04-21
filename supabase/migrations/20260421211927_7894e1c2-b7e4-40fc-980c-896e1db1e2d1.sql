ALTER TABLE public.deliverers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.deliverers ADD COLUMN IF NOT EXISTS user_id uuid;

DROP POLICY IF EXISTS "Roles admin all" ON public.user_roles;
CREATE POLICY "Roles admin all"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Orders deliverer select" ON public.orders;
CREATE POLICY "Orders deliverer select"
ON public.orders
FOR SELECT
USING (
  public.has_role(auth.uid(), 'deliverer')
  AND deliverer_id IN (SELECT id FROM public.deliverers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Orders deliverer update" ON public.orders;
CREATE POLICY "Orders deliverer update"
ON public.orders
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'deliverer')
  AND deliverer_id IN (SELECT id FROM public.deliverers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Order items deliverer select" ON public.order_items;
CREATE POLICY "Order items deliverer select"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.deliverers d ON d.id = o.deliverer_id
    WHERE o.id = order_items.order_id AND d.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.link_deliverer_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.deliverers
  SET user_id = NEW.id
  WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;

  IF EXISTS (SELECT 1 FROM public.deliverers WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'deliverer'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_deliverer_on_profile_insert ON public.profiles;
CREATE TRIGGER link_deliverer_on_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.link_deliverer_on_signup();