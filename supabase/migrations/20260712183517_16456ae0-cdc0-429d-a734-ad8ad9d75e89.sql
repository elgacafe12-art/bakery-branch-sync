
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'inventory','inventory_movements','ingredients','products',
    'suppliers','supplier_deliveries','supplier_delivery_items',
    'requests','request_items','productions','production_ingredients',
    'damage_logs','profiles','user_roles','portal_pins'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
             WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
