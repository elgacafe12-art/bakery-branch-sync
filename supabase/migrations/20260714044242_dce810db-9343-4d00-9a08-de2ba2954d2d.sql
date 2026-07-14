
REVOKE ALL ON FUNCTION public.trg_damage_log_to_movement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_damage_log_to_movement() TO service_role;
