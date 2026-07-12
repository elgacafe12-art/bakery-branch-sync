CREATE OR REPLACE FUNCTION public.verify_portal_pin(_pin text)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.role FROM public.portal_pins AS p WHERE p.pin = _pin AND _pin ~ '^\d{4}$' LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.verify_portal_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_portal_pin(text) TO anon, authenticated;