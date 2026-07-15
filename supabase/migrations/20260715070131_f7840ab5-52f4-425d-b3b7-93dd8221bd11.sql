-- Restrict notify_users to service_role only (triggers still work as SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.notify_users(public.app_role[], uuid[], text, text, text, text, text, public.location_type, public.item_type, uuid, numeric, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_users(public.app_role[], uuid[], text, text, text, text, text, public.location_type, public.item_type, uuid, numeric, text, uuid, jsonb) TO service_role;

-- Remove portal_pins from realtime publication (sensitive credential table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'portal_pins'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.portal_pins';
  END IF;
END $$;