
-- Prevent negative stock on 'usage' movement
CREATE OR REPLACE FUNCTION public.check_usage_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_qty numeric;
BEGIN
  IF NEW.movement = 'usage'::public.movement_type THEN
    -- usage rows must be negative (deduction)
    IF NEW.quantity >= 0 THEN
      NEW.quantity := -abs(NEW.quantity);
    END IF;

    SELECT quantity INTO current_qty
    FROM public.inventory
    WHERE location = NEW.location AND item_type = NEW.item_type AND item_id = NEW.item_id;

    IF current_qty IS NULL OR current_qty + NEW.quantity < 0 THEN
      RAISE EXCEPTION 'Insufficient stock: available %, requested %',
        COALESCE(current_qty, 0), abs(NEW.quantity)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_check_usage_stock ON public.inventory_movements;
CREATE TRIGGER trg_check_usage_stock
  BEFORE INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.check_usage_stock();

-- Extend movement notification trigger to include 'usage'
CREATE OR REPLACE FUNCTION public.trg_notify_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_name text;
  loc_role public.app_role;
BEGIN
  item_name := public.item_display_name(NEW.item_type, NEW.item_id);
  loc_role := public.role_for_location(NEW.location);

  IF NEW.movement = 'supplier_in' THEN
    PERFORM public.notify_users(
      ARRAY['admin','central_store']::public.app_role[], NULL,
      'stock_received', 'normal',
      'Central Store received stock',
      COALESCE(item_name,'Item') || ' +' || NEW.quantity::text,
      '/inventory', NEW.location, NEW.item_type, NEW.item_id, NEW.quantity,
      'inventory_movement', NEW.id, '{}'::jsonb);
  ELSIF NEW.movement IN ('production_in') THEN
    PERFORM public.notify_users(
      ARRAY['admin','central_bakery']::public.app_role[], NULL,
      'production', 'normal',
      'Production completed',
      COALESCE(item_name,'Product') || ' produced +' || NEW.quantity::text,
      '/production', NEW.location, NEW.item_type, NEW.item_id, NEW.quantity,
      'production', NEW.reference_id, '{}'::jsonb);
  ELSIF NEW.movement = 'delivery_out' THEN
    PERFORM public.notify_users(
      ARRAY['admin', loc_role]::public.app_role[], NULL,
      'transfer_out', 'normal',
      'Stock transferred out',
      COALESCE(item_name,'Item') || ' ' || NEW.quantity::text || ' from ' || NEW.location::text,
      '/movements', NEW.location, NEW.item_type, NEW.item_id, NEW.quantity,
      'inventory_movement', NEW.id, '{}'::jsonb);
  ELSIF NEW.movement = 'delivery_in' THEN
    PERFORM public.notify_users(
      ARRAY['admin', loc_role]::public.app_role[], NULL,
      'transfer_in', 'normal',
      CASE WHEN NEW.location IN ('branch_1','branch_2') THEN 'Branch received stock'
           WHEN NEW.location = 'central_bakery' THEN 'Bakery received stock'
           ELSE 'Stock received' END,
      COALESCE(item_name,'Item') || ' +' || NEW.quantity::text || ' at ' || NEW.location::text,
      '/inventory', NEW.location, NEW.item_type, NEW.item_id, NEW.quantity,
      'inventory_movement', NEW.id, '{}'::jsonb);
  ELSIF NEW.movement = 'adjustment' THEN
    PERFORM public.notify_users(
      ARRAY['admin', loc_role]::public.app_role[], NULL,
      'adjustment', 'normal',
      'Stock adjustment',
      COALESCE(item_name,'Item') || ' ' || NEW.quantity::text,
      '/movements', NEW.location, NEW.item_type, NEW.item_id, NEW.quantity,
      'inventory_movement', NEW.id, '{}'::jsonb);
  ELSIF NEW.movement = 'damage' THEN
    PERFORM public.notify_users(
      ARRAY['admin', loc_role]::public.app_role[], NULL,
      'damage', 'critical',
      'Damage recorded',
      COALESCE(item_name,'Item') || ' ' || NEW.quantity::text,
      '/damage', NEW.location, NEW.item_type, NEW.item_id, NEW.quantity,
      'inventory_movement', NEW.id, '{}'::jsonb);
  ELSIF NEW.movement = 'usage' THEN
    PERFORM public.notify_users(
      ARRAY['admin', loc_role]::public.app_role[], NULL,
      'usage', 'normal',
      'Raw material usage',
      COALESCE(item_name,'Item') || ' ' || NEW.quantity::text || ' at ' || NEW.location::text,
      '/usage', NEW.location, NEW.item_type, NEW.item_id, NEW.quantity,
      'inventory_movement', NEW.id, '{}'::jsonb);
  END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.check_usage_stock() FROM PUBLIC, anon, authenticated;
