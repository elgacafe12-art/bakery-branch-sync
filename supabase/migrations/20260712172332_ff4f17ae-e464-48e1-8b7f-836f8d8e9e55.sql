
-- ============================================================
-- Notification System Upgrade
-- ============================================================

-- 1. Extend notifications table
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS location public.location_type,
  ADD COLUMN IF NOT EXISTS item_type public.item_type,
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS quantity numeric,
  ADD COLUMN IF NOT EXISTS related_type text,
  ADD COLUMN IF NOT EXISTS related_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Allow deletes by owner
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2. push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ps_select_own ON public.push_subscriptions;
CREATE POLICY ps_select_own ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS ps_insert_own ON public.push_subscriptions;
CREATE POLICY ps_insert_own ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS ps_delete_own ON public.push_subscriptions;
CREATE POLICY ps_delete_own ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS ps_update_own ON public.push_subscriptions;
CREATE POLICY ps_update_own ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. notification_settings table (user prefs: sounds on/off etc.)
CREATE TABLE IF NOT EXISTS public.notification_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sound_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ns_own ON public.notification_settings;
CREATE POLICY ns_own ON public.notification_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Enable Realtime on notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 5. Core notify helper: fanout to user_ids + roles
CREATE OR REPLACE FUNCTION public.notify_users(
  _roles public.app_role[],
  _user_ids uuid[],
  _type text,
  _priority text,
  _title text,
  _message text,
  _link text DEFAULT NULL,
  _location public.location_type DEFAULT NULL,
  _item_type public.item_type DEFAULT NULL,
  _item_id uuid DEFAULT NULL,
  _quantity numeric DEFAULT NULL,
  _related_type text DEFAULT NULL,
  _related_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_ids uuid[];
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    WHERE (_roles IS NOT NULL AND ur.role = ANY(_roles))
       OR (_user_ids IS NOT NULL AND ur.user_id = ANY(_user_ids))
  ) INTO target_ids;

  IF _user_ids IS NOT NULL THEN
    target_ids := ARRAY(SELECT DISTINCT unnest(target_ids || _user_ids));
  END IF;

  IF target_ids IS NULL OR array_length(target_ids,1) IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications
    (user_id, target_role, title, message, link, read, type, priority,
     location, item_type, item_id, quantity, related_type, related_id, metadata)
  SELECT uid, NULL, _title, _message, _link, false, _type, _priority,
         _location, _item_type, _item_id, _quantity, _related_type, _related_id, _metadata
  FROM unnest(target_ids) AS uid;
END $$;

REVOKE ALL ON FUNCTION public.notify_users(public.app_role[], uuid[], text, text, text, text, text, public.location_type, public.item_type, uuid, numeric, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_users(public.app_role[], uuid[], text, text, text, text, text, public.location_type, public.item_type, uuid, numeric, text, uuid, jsonb) TO authenticated, service_role;

-- 6. Helper: role for location
CREATE OR REPLACE FUNCTION public.role_for_location(_loc public.location_type)
RETURNS public.app_role LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _loc
    WHEN 'central_store'::public.location_type THEN 'central_store'::public.app_role
    WHEN 'central_bakery'::public.location_type THEN 'central_bakery'::public.app_role
    WHEN 'branch_1'::public.location_type THEN 'branch_1'::public.app_role
    WHEN 'branch_2'::public.location_type THEN 'branch_2'::public.app_role
  END
$$;

-- 7. Item name lookup
CREATE OR REPLACE FUNCTION public.item_display_name(_type public.item_type, _id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE _type
    WHEN 'ingredient'::public.item_type THEN (SELECT name FROM public.ingredients WHERE id = _id)
    WHEN 'product'::public.item_type THEN (SELECT name FROM public.products WHERE id = _id)
  END
$$;

-- ============================================================
-- 8. Triggers
-- ============================================================

-- Supplier delivery inserted → notify admin + central_store
CREATE OR REPLACE FUNCTION public.trg_notify_supplier_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  supplier_name text;
BEGIN
  SELECT name INTO supplier_name FROM public.suppliers WHERE id = NEW.supplier_id;
  PERFORM public.notify_users(
    ARRAY['admin','central_store']::public.app_role[], NULL,
    'supplier_delivery', 'normal',
    'Supplier delivery received',
    COALESCE(supplier_name,'Supplier') || ' delivered — invoice ' || COALESCE(NEW.invoice_number,'(none)'),
    '/receive', 'central_store'::public.location_type, NULL, NULL, NULL,
    'supplier_delivery', NEW.id, jsonb_build_object('supplier', supplier_name)
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_supplier_delivery ON public.supplier_deliveries;
CREATE TRIGGER notify_supplier_delivery AFTER INSERT ON public.supplier_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_supplier_delivery();

-- Inventory movement inserted → notify by movement type
CREATE OR REPLACE FUNCTION public.trg_notify_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_movement ON public.inventory_movements;
CREATE TRIGGER notify_movement AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_movement();

-- Requests lifecycle
CREATE OR REPLACE FUNCTION public.trg_notify_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  from_role public.app_role;
  to_role public.app_role;
BEGIN
  from_role := public.role_for_location(NEW.from_location);
  to_role   := public.role_for_location(NEW.to_location);

  IF TG_OP = 'INSERT' THEN
    -- New request pending approval
    PERFORM public.notify_users(
      ARRAY['admin', from_role]::public.app_role[], NULL,
      'request_new', 'normal',
      'New transfer request',
      NEW.request_number || ': ' || NEW.from_location::text || ' → ' || NEW.to_location::text,
      '/requests/' || NEW.id, NEW.to_location, NEW.item_type, NULL, NULL,
      'request', NEW.id, '{}'::jsonb);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.notify_users(
        ARRAY['delivery_man']::public.app_role[],
        CASE WHEN NEW.requested_by IS NOT NULL THEN ARRAY[NEW.requested_by] ELSE NULL END,
        'request_approved', 'normal',
        'Request approved', NEW.request_number || ' approved',
        '/requests/' || NEW.id, NEW.to_location, NEW.item_type, NULL, NULL,
        'request', NEW.id, '{}'::jsonb);
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.notify_users(
        NULL, CASE WHEN NEW.requested_by IS NOT NULL THEN ARRAY[NEW.requested_by] ELSE NULL END,
        'request_rejected', 'critical',
        'Request rejected',
        NEW.request_number || ' rejected' || COALESCE(': ' || NEW.rejection_reason, ''),
        '/requests/' || NEW.id, NEW.to_location, NEW.item_type, NULL, NULL,
        'request', NEW.id, '{}'::jsonb);
    ELSIF NEW.status = 'assigned' THEN
      PERFORM public.notify_users(
        NULL, CASE WHEN NEW.delivery_man_id IS NOT NULL THEN ARRAY[NEW.delivery_man_id] ELSE NULL END,
        'delivery_assigned', 'normal',
        'Delivery assigned', 'Pickup for ' || NEW.request_number,
        '/requests/' || NEW.id, NEW.from_location, NEW.item_type, NULL, NULL,
        'request', NEW.id, '{}'::jsonb);
    ELSIF NEW.status = 'completed' THEN
      PERFORM public.notify_users(
        ARRAY['admin', to_role]::public.app_role[],
        CASE WHEN NEW.requested_by IS NOT NULL THEN ARRAY[NEW.requested_by] ELSE NULL END,
        'delivery_completed', 'normal',
        'Delivery completed', NEW.request_number || ' completed',
        '/requests/' || NEW.id, NEW.to_location, NEW.item_type, NULL, NULL,
        'request', NEW.id, '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_request_insert ON public.requests;
CREATE TRIGGER notify_request_insert AFTER INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_request();
DROP TRIGGER IF EXISTS notify_request_update ON public.requests;
CREATE TRIGGER notify_request_update AFTER UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_request();

-- Low stock trigger on inventory
CREATE OR REPLACE FUNCTION public.trg_notify_low_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  min_s numeric;
  nm text;
  loc_role public.app_role;
  prio text;
  old_qty numeric;
BEGIN
  IF NEW.item_type = 'ingredient' THEN
    SELECT min_stock, name INTO min_s, nm FROM public.ingredients WHERE id = NEW.item_id;
  ELSE
    SELECT min_stock, name INTO min_s, nm FROM public.products WHERE id = NEW.item_id;
  END IF;
  IF min_s IS NULL OR min_s <= 0 THEN RETURN NEW; END IF;

  old_qty := CASE WHEN TG_OP = 'UPDATE' THEN OLD.quantity ELSE NULL END;

  -- only fire on threshold crossing
  IF NEW.quantity <= min_s AND (old_qty IS NULL OR old_qty > min_s OR (NEW.quantity <= 0 AND old_qty > 0)) THEN
    loc_role := public.role_for_location(NEW.location);
    prio := CASE WHEN NEW.quantity <= 0 THEN 'critical' ELSE 'critical' END;
    PERFORM public.notify_users(
      ARRAY['admin', loc_role]::public.app_role[], NULL,
      CASE WHEN NEW.quantity <= 0 THEN 'out_of_stock' ELSE 'low_stock' END,
      prio,
      CASE WHEN NEW.quantity <= 0 THEN 'Out of stock' ELSE 'Low stock alert' END,
      COALESCE(nm,'Item') || ' at ' || NEW.location::text || ' — ' || NEW.quantity::text || ' (min ' || min_s::text || ')',
      '/inventory', NEW.location, NEW.item_type, NEW.item_id, NEW.quantity,
      'inventory', NEW.id, jsonb_build_object('min_stock', min_s));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_low_stock ON public.inventory;
CREATE TRIGGER notify_low_stock AFTER INSERT OR UPDATE OF quantity ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_low_stock();

-- Damage log
CREATE OR REPLACE FUNCTION public.trg_notify_damage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text;
BEGIN
  nm := public.item_display_name(NEW.item_type, NEW.item_id);
  PERFORM public.notify_users(
    ARRAY['admin', public.role_for_location(NEW.location)]::public.app_role[], NULL,
    'damage_reported', 'critical',
    'Damage reported',
    COALESCE(nm,'Item') || ' — ' || NEW.quantity::text || ' at ' || NEW.location::text,
    '/damage', NEW.location, NEW.item_type, NEW.item_id, NEW.quantity,
    'damage_log', NEW.id, '{}'::jsonb);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_damage ON public.damage_logs;
CREATE TRIGGER notify_damage AFTER INSERT ON public.damage_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_damage();

-- Reminder function
CREATE OR REPLACE FUNCTION public.emit_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
BEGIN
  -- Pending requests older than 1h without recent reminder
  FOR r IN
    SELECT req.id, req.request_number, req.from_location
    FROM public.requests req
    WHERE req.status = 'pending' AND req.created_at < now() - interval '1 hour'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.related_type = 'request' AND n.related_id = req.id
          AND n.type = 'reminder_pending' AND n.created_at > now() - interval '2 hours')
  LOOP
    PERFORM public.notify_users(
      ARRAY['admin', public.role_for_location(r.from_location)]::public.app_role[], NULL,
      'reminder_pending', 'normal',
      'Pending request reminder',
      r.request_number || ' still awaiting approval',
      '/requests/' || r.id, NULL, NULL, NULL, NULL,
      'request', r.id, '{}'::jsonb);
  END LOOP;

  -- Delayed deliveries (assigned/picked_up > 4h)
  FOR r IN
    SELECT req.id, req.request_number, req.delivery_man_id
    FROM public.requests req
    WHERE req.status IN ('assigned','picked_up')
      AND req.approved_at < now() - interval '4 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.related_type = 'request' AND n.related_id = req.id
          AND n.type = 'reminder_delayed' AND n.created_at > now() - interval '4 hours')
  LOOP
    PERFORM public.notify_users(
      ARRAY['admin']::public.app_role[],
      CASE WHEN r.delivery_man_id IS NOT NULL THEN ARRAY[r.delivery_man_id] ELSE NULL END,
      'reminder_delayed', 'critical',
      'Delivery delayed',
      r.request_number || ' has been in progress > 4h',
      '/requests/' || r.id, NULL, NULL, NULL, NULL,
      'request', r.id, '{}'::jsonb);
  END LOOP;

  -- Repeat low-stock reminders
  FOR r IN
    SELECT inv.id, inv.location, inv.item_type, inv.item_id, inv.quantity,
           CASE inv.item_type WHEN 'ingredient' THEN (SELECT min_stock FROM public.ingredients WHERE id = inv.item_id)
                              ELSE (SELECT min_stock FROM public.products WHERE id = inv.item_id) END AS min_s,
           CASE inv.item_type WHEN 'ingredient' THEN (SELECT name FROM public.ingredients WHERE id = inv.item_id)
                              ELSE (SELECT name FROM public.products WHERE id = inv.item_id) END AS nm
    FROM public.inventory inv
  LOOP
    IF r.min_s IS NULL OR r.min_s <= 0 THEN CONTINUE; END IF;
    IF r.quantity <= r.min_s AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.related_type = 'inventory' AND n.related_id = r.id
        AND n.type IN ('low_stock','out_of_stock','reminder_low_stock')
        AND n.created_at > now() - interval '6 hours')
    THEN
      PERFORM public.notify_users(
        ARRAY['admin', public.role_for_location(r.location)]::public.app_role[], NULL,
        'reminder_low_stock', 'critical',
        CASE WHEN r.quantity <= 0 THEN 'Still out of stock' ELSE 'Still low on stock' END,
        COALESCE(r.nm,'Item') || ' at ' || r.location::text || ' — ' || r.quantity::text || ' (min ' || r.min_s::text || ')',
        '/inventory', r.location, r.item_type, r.item_id, r.quantity,
        'inventory', r.id, jsonb_build_object('min_stock', r.min_s));
    END IF;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.emit_reminders() TO service_role, authenticated;
