
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_place text;

CREATE OR REPLACE FUNCTION public.notify_on_delivered()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item_list text;
  full_name text;
BEGIN
  IF NEW.delivery_stage = 'delivered' AND (OLD.delivery_stage IS DISTINCT FROM 'delivered') THEN
    SELECT string_agg(product_name || ' x' || quantity, ', ')
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
      'Your order has been delivered successfully. Items: ' || COALESCE(item_list, '-') || '. Thank you for shopping with Luxe Sparkles.'
    );
  END IF;
  RETURN NEW;
END;
$function$;
