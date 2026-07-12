-- ================= ENUMS =================
CREATE TYPE public.app_role AS ENUM ('admin','central_store','central_bakery','delivery_man','branch_1','branch_2');
CREATE TYPE public.location_type AS ENUM ('central_store','central_bakery','branch_1','branch_2');
CREATE TYPE public.item_type AS ENUM ('ingredient','product');
CREATE TYPE public.request_status AS ENUM ('pending','approved','rejected','assigned','picked_up','delivered','completed','cancelled');
CREATE TYPE public.movement_type AS ENUM ('supplier_in','delivery_out','delivery_in','production_in','production_out','damage','adjustment');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Private helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;
CREATE OR REPLACE FUNCTION private.user_location(_user_id uuid)
RETURNS public.location_type LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN private.has_role(_user_id,'central_store') THEN 'central_store'::public.location_type
    WHEN private.has_role(_user_id,'central_bakery') THEN 'central_bakery'::public.location_type
    WHEN private.has_role(_user_id,'branch_1') THEN 'branch_1'::public.location_type
    WHEN private.has_role(_user_id,'branch_2') THEN 'branch_2'::public.location_type
    ELSE NULL END
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_location(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_location(uuid) TO authenticated, service_role;

CREATE POLICY profiles_self_read ON public.profiles FOR SELECT USING ((auth.uid() = id) OR private.is_admin(auth.uid()));
CREATE POLICY profiles_self_write ON public.profiles FOR UPDATE USING ((auth.uid() = id) OR private.is_admin(auth.uid()));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id) OR private.is_admin(auth.uid()));
CREATE POLICY user_roles_read ON public.user_roles FOR SELECT USING ((user_id = auth.uid()) OR private.is_admin(auth.uid()));
CREATE POLICY user_roles_admin_manage ON public.user_roles FOR ALL USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_count int;
  mapped_role public.app_role;
BEGIN
  INSERT INTO public.profiles(id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  mapped_role := CASE lower(NEW.email)
    WHEN 'admin@elga.local'    THEN 'admin'::public.app_role
    WHEN 'store@elga.local'    THEN 'central_store'::public.app_role
    WHEN 'bakery@elga.local'   THEN 'central_bakery'::public.app_role
    WHEN 'delivery@elga.local' THEN 'delivery_man'::public.app_role
    WHEN 'branch1@elga.local'  THEN 'branch_1'::public.app_role
    WHEN 'branch2@elga.local'  THEN 'branch_2'::public.app_role
    ELSE NULL
  END;
  IF mapped_role IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, mapped_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT, phone TEXT, email TEXT, address TEXT,
  supplies_raw_ingredients boolean NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY suppliers_read ON public.suppliers FOR SELECT USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_store'::public.app_role));
CREATE POLICY suppliers_write ON public.suppliers FOR ALL USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_store'::public.app_role)) WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_store'::public.app_role));

-- ingredients
CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  category TEXT,
  min_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  can_go_to_branch BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients TO authenticated;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ingredients_updated BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY ingredients_read ON public.ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY ingredients_write ON public.ingredients FOR ALL USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'piece',
  min_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true, deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY products_read ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY products_write ON public.products FOR ALL USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- inventory
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location location_type NOT NULL,
  item_type item_type NOT NULL,
  item_id UUID NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location, item_type, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY inventory_read ON public.inventory FOR SELECT USING (
  private.is_admin(auth.uid())
  OR private.has_role(auth.uid(), 'central_store'::public.app_role)
  OR private.has_role(auth.uid(), 'central_bakery'::public.app_role)
  OR private.user_location(auth.uid()) = location
);
CREATE POLICY inventory_write ON public.inventory FOR ALL USING (
  private.is_admin(auth.uid())
  OR private.has_role(auth.uid(), 'central_store'::public.app_role)
  OR private.has_role(auth.uid(), 'central_bakery'::public.app_role)
) WITH CHECK (
  private.is_admin(auth.uid())
  OR private.has_role(auth.uid(), 'central_store'::public.app_role)
  OR private.has_role(auth.uid(), 'central_bakery'::public.app_role)
);

-- movements
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location location_type NOT NULL,
  item_type item_type NOT NULL, item_id UUID NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  movement movement_type NOT NULL,
  reference_type TEXT, reference_id UUID, notes TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY movements_read ON public.inventory_movements FOR SELECT USING (
  private.is_admin(auth.uid()) OR private.user_location(auth.uid()) = location
);
CREATE POLICY movements_insert ON public.inventory_movements
FOR INSERT TO authenticated WITH CHECK (
  performed_by = auth.uid()
  AND (
    private.is_admin(auth.uid())
    OR (private.has_role(auth.uid(), 'central_store'::app_role) AND location = 'central_store'::location_type)
    OR (private.has_role(auth.uid(), 'central_bakery'::app_role) AND location = 'central_bakery'::location_type)
  )
);

CREATE OR REPLACE FUNCTION public.apply_movement() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.inventory(location, item_type, item_id, quantity)
  VALUES (NEW.location, NEW.item_type, NEW.item_id, NEW.quantity)
  ON CONFLICT (location, item_type, item_id) DO UPDATE SET quantity = public.inventory.quantity + NEW.quantity, updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_apply_movement AFTER INSERT ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.apply_movement();
REVOKE ALL ON FUNCTION public.apply_movement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- supplier deliveries
CREATE TABLE public.supplier_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  invoice_number TEXT, delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0, notes TEXT,
  received_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_deliveries TO authenticated;
GRANT ALL ON public.supplier_deliveries TO service_role;
ALTER TABLE public.supplier_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY sd_read ON public.supplier_deliveries FOR SELECT USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_store'::public.app_role));
CREATE POLICY sd_write ON public.supplier_deliveries FOR ALL USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_store'::public.app_role)) WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_store'::public.app_role));

CREATE TABLE public.supplier_delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.supplier_deliveries(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id),
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  expiry_date DATE, notes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_delivery_items TO authenticated;
GRANT ALL ON public.supplier_delivery_items TO service_role;
ALTER TABLE public.supplier_delivery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdi_read ON public.supplier_delivery_items FOR SELECT USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_store'::public.app_role));
CREATE POLICY sdi_write ON public.supplier_delivery_items FOR ALL USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_store'::public.app_role)) WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_store'::public.app_role));

-- requests
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE DEFAULT ('REQ-' || to_char(now(),'YYMMDD') || '-' || substring(gen_random_uuid()::text,1,6)),
  from_location location_type NOT NULL,
  to_location location_type NOT NULL,
  item_type item_type NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  delivery_man_id UUID REFERENCES auth.users(id),
  notes TEXT, rejection_reason TEXT,
  approved_at TIMESTAMPTZ, picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY requests_read ON public.requests FOR SELECT USING (
  private.is_admin(auth.uid())
  OR requested_by = auth.uid()
  OR delivery_man_id = auth.uid()
  OR (private.has_role(auth.uid(), 'central_store'::public.app_role) AND from_location = 'central_store'::public.location_type)
  OR (private.has_role(auth.uid(), 'central_bakery'::public.app_role) AND (from_location = 'central_bakery'::public.location_type OR to_location = 'central_bakery'::public.location_type))
  OR (private.has_role(auth.uid(), 'branch_1'::public.app_role) AND to_location = 'branch_1'::public.location_type)
  OR (private.has_role(auth.uid(), 'branch_2'::public.app_role) AND to_location = 'branch_2'::public.location_type)
);
CREATE POLICY requests_insert ON public.requests FOR INSERT WITH CHECK (
  (requested_by = auth.uid()) AND (private.user_location(auth.uid()) = to_location)
);
CREATE POLICY requests_update ON public.requests FOR UPDATE USING (
  private.is_admin(auth.uid())
  OR (private.has_role(auth.uid(), 'central_store'::public.app_role) AND from_location = 'central_store'::public.location_type)
  OR (private.has_role(auth.uid(), 'central_bakery'::public.app_role) AND from_location = 'central_bakery'::public.location_type)
  OR delivery_man_id = auth.uid()
  OR private.user_location(auth.uid()) = to_location
);

CREATE TABLE public.request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  approved_quantity NUMERIC(14,3),
  delivered_quantity NUMERIC(14,3),
  damaged_quantity NUMERIC(14,3) DEFAULT 0,
  missing_quantity NUMERIC(14,3) DEFAULT 0,
  notes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_items TO authenticated;
GRANT ALL ON public.request_items TO service_role;
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY ri_read ON public.request_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_items.request_id AND (
    private.is_admin(auth.uid())
    OR r.requested_by = auth.uid()
    OR r.delivery_man_id = auth.uid()
    OR (private.has_role(auth.uid(), 'central_store'::public.app_role) AND r.from_location = 'central_store'::public.location_type)
    OR (private.has_role(auth.uid(), 'central_bakery'::public.app_role) AND (r.from_location = 'central_bakery'::public.location_type OR r.to_location = 'central_bakery'::public.location_type))
    OR (private.has_role(auth.uid(), 'branch_1'::public.app_role) AND r.to_location = 'branch_1'::public.location_type)
    OR (private.has_role(auth.uid(), 'branch_2'::public.app_role) AND r.to_location = 'branch_2'::public.location_type)
  ))
);
CREATE POLICY ri_write ON public.request_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_items.request_id AND (
    private.is_admin(auth.uid())
    OR r.requested_by = auth.uid()
    OR (private.has_role(auth.uid(), 'central_store'::public.app_role) AND r.from_location = 'central_store'::public.location_type)
    OR (private.has_role(auth.uid(), 'central_bakery'::public.app_role) AND r.from_location = 'central_bakery'::public.location_type)
    OR private.user_location(auth.uid()) = r.to_location
  ))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_items.request_id AND (
    private.is_admin(auth.uid())
    OR r.requested_by = auth.uid()
    OR (private.has_role(auth.uid(), 'central_store'::public.app_role) AND r.from_location = 'central_store'::public.location_type)
    OR (private.has_role(auth.uid(), 'central_bakery'::public.app_role) AND r.from_location = 'central_bakery'::public.location_type)
    OR private.user_location(auth.uid()) = r.to_location
  ))
);

-- productions
CREATE TABLE public.productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity_produced NUMERIC(14,3) NOT NULL,
  produced_by UUID REFERENCES auth.users(id),
  notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.productions TO authenticated;
GRANT ALL ON public.productions TO service_role;
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;
CREATE POLICY prod_read ON public.productions FOR SELECT TO authenticated USING (true);
CREATE POLICY prod_insert ON public.productions FOR INSERT WITH CHECK (
  private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_bakery'::public.app_role)
);

CREATE TABLE public.production_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id),
  quantity_used NUMERIC(14,3) NOT NULL
);
GRANT SELECT, INSERT ON public.production_ingredients TO authenticated;
GRANT ALL ON public.production_ingredients TO service_role;
ALTER TABLE public.production_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY pi_read ON public.production_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY pi_insert ON public.production_ingredients FOR INSERT WITH CHECK (
  private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_bakery'::public.app_role)
);

-- notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role app_role,
  title TEXT NOT NULL, message TEXT NOT NULL, link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_read ON public.notifications FOR SELECT USING (
  user_id = auth.uid()
  OR (target_role IS NOT NULL AND private.has_role(auth.uid(), target_role))
  OR private.is_admin(auth.uid())
);
CREATE POLICY notif_update ON public.notifications FOR UPDATE USING (
  user_id = auth.uid()
  OR (target_role IS NOT NULL AND private.has_role(auth.uid(), target_role))
  OR private.is_admin(auth.uid())
);
CREATE POLICY notif_insert ON public.notifications
FOR INSERT TO authenticated WITH CHECK (
  private.is_admin(auth.uid())
  OR (target_role IS NULL AND user_id IS NOT NULL AND user_id = auth.uid())
);

-- audit
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, entity_type TEXT, entity_id UUID,
  previous_value JSONB, new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON public.audit_logs FOR SELECT USING (private.is_admin(auth.uid()));
CREATE POLICY audit_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (false);

-- damage logs
CREATE TABLE public.damage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location location_type NOT NULL,
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  item_type item_type, item_id uuid, quantity numeric,
  reason text NOT NULL, photo_url text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.damage_logs TO authenticated;
GRANT ALL ON public.damage_logs TO service_role;
ALTER TABLE public.damage_logs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER damage_logs_updated_at BEFORE UPDATE ON public.damage_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Damage logs visible to admin or reporter" ON public.damage_logs FOR SELECT USING (private.is_admin(auth.uid()) OR reporter_id = auth.uid());
CREATE POLICY "Reporters can insert their own damage logs" ON public.damage_logs FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Admins can update or delete damage logs" ON public.damage_logs FOR UPDATE USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete damage logs" ON public.damage_logs FOR DELETE USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- portal_pins
CREATE TABLE public.portal_pins (
  role public.app_role PRIMARY KEY,
  pin text NOT NULL UNIQUE CHECK (pin ~ '^\d{4}$'),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_pins TO authenticated;
GRANT ALL ON public.portal_pins TO service_role;
ALTER TABLE public.portal_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read pins" ON public.portal_pins FOR SELECT TO authenticated USING (private.is_admin(auth.uid()));
CREATE POLICY "admin write pins" ON public.portal_pins FOR ALL TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE TRIGGER trg_portal_pins_updated BEFORE UPDATE ON public.portal_pins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.portal_pins (role, pin) VALUES
  ('admin'::public.app_role,'3234'),
  ('central_store'::public.app_role,'4444'),
  ('central_bakery'::public.app_role,'5555'),
  ('delivery_man'::public.app_role,'1234'),
  ('branch_1'::public.app_role,'4321'),
  ('branch_2'::public.app_role,'3333')
ON CONFLICT (role) DO NOTHING;

-- Indexes
CREATE INDEX idx_inventory_lookup ON public.inventory(location, item_type, item_id);
CREATE INDEX idx_movements_created ON public.inventory_movements(created_at DESC);
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_from ON public.requests(from_location);
CREATE INDEX idx_requests_to ON public.requests(to_location);
CREATE INDEX idx_notif_user ON public.notifications(user_id, read);

-- Computed relationships for PostgREST inventory embedding
CREATE OR REPLACE FUNCTION public.ingredients(public.inventory)
RETURNS SETOF public.ingredients ROWS 1 LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT * FROM public.ingredients WHERE id = $1.item_id AND $1.item_type = 'ingredient'
$$;
CREATE OR REPLACE FUNCTION public.products(public.inventory)
RETURNS SETOF public.products ROWS 1 LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT * FROM public.products WHERE id = $1.item_id AND $1.item_type = 'product'
$$;
GRANT EXECUTE ON FUNCTION public.ingredients(public.inventory) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.products(public.inventory) TO anon, authenticated, service_role;

-- verify_portal_pin: public wrapper -> private impl
CREATE OR REPLACE FUNCTION private.verify_portal_pin(_pin text)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.role FROM public.portal_pins AS p WHERE p.pin = _pin AND _pin ~ '^\d{4}$' LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.verify_portal_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.verify_portal_pin(text) TO service_role, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_portal_pin(_pin text)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS $$
  SELECT private.verify_portal_pin(_pin)
$$;
REVOKE ALL ON FUNCTION public.verify_portal_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_portal_pin(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';