
REVOKE ALL ON FUNCTION public.notify_users(public.app_role[], uuid[], text, text, text, text, text, public.location_type, public.item_type, uuid, numeric, text, uuid, jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.notify_users(public.app_role[], uuid[], text, text, text, text, text, public.location_type, public.item_type, uuid, numeric, text, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.emit_reminders() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.emit_reminders() TO service_role;

REVOKE ALL ON FUNCTION public.trg_notify_supplier_delivery() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.trg_notify_movement() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.trg_notify_request() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.trg_notify_low_stock() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.trg_notify_damage() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.item_display_name(public.item_type, uuid) FROM PUBLIC, anon;
