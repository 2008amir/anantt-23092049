
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  kind text NOT NULL DEFAULT 'post',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  image text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications admin all"
ON public.notifications FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Notifications user select"
ON public.notifications FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Notifications user update own"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

-- Auto-congrats trigger on delivered
CREATE OR REPLACE FUNCTION public.notify_on_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_list text;
  full_name text;
BEGIN
  IF NEW.delivery_stage = 'delivered' AND (OLD.delivery_stage IS DISTINCT FROM 'delivered') THEN
    SELECT string_agg(product_name || ' ×' || quantity, ', ')
      INTO item_list
      FROM public.order_items
      WHERE order_id = NEW.id;

    SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), display_name, email)
      INTO full_name
      FROM public.profiles
      WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (
      NEW.user_id,
      'order',
      'Congratulations, ' || COALESCE(full_name, 'friend') || '!',
      'Your order has been delivered successfully. Items: ' || COALESCE(item_list, '—') || '. Thank you for shopping with Maison Luxe.'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_notify_on_delivered ON public.orders;
CREATE TRIGGER orders_notify_on_delivered
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_delivered();
