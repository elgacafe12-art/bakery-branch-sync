
-- Extend stock guard to also cover 'damage' movements
CREATE OR REPLACE FUNCTION public.check_usage_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_qty numeric;
BEGIN
  IF NEW.movement IN ('usage'::public.movement_type, 'damage'::public.movement_type) THEN
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

-- When a damage_log is inserted with a concrete item + quantity, auto-create
-- an inventory_movement to deduct stock. This keeps the existing damage_logs
-- UI/workflow intact while ensuring stock, reports, dashboards, and
-- notifications all update automatically.
CREATE OR REPLACE FUNCTION public.trg_damage_log_to_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.item_type IS NOT NULL
     AND NEW.item_id IS NOT NULL
     AND NEW.quantity IS NOT NULL
     AND NEW.quantity > 0 THEN
    INSERT INTO public.inventory_movements
      (location, item_type, item_id, quantity, movement, reference_type, reference_id, notes, created_by)
    VALUES
      (NEW.location, NEW.item_type, NEW.item_id, -abs(NEW.quantity),
       'damage'::public.movement_type, 'damage_log', NEW.id,
       NEW.reason, NEW.reporter_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_damage_log_to_movement ON public.damage_logs;
CREATE TRIGGER trg_damage_log_to_movement
  AFTER INSERT ON public.damage_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_damage_log_to_movement();
