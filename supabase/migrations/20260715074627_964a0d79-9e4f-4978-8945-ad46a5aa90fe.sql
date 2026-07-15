CREATE OR REPLACE FUNCTION public.trg_damage_log_to_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.item_type IS NOT NULL
     AND NEW.item_id IS NOT NULL
     AND NEW.quantity IS NOT NULL
     AND NEW.quantity > 0 THEN
    INSERT INTO public.inventory_movements
      (location, item_type, item_id, quantity, movement, reference_type, reference_id, notes, performed_by)
    VALUES
      (NEW.location, NEW.item_type, NEW.item_id, -abs(NEW.quantity),
       'damage'::public.movement_type, 'damage_log', NEW.id,
       NEW.reason, NEW.reporter_id);
  END IF;
  RETURN NEW;
END $function$;