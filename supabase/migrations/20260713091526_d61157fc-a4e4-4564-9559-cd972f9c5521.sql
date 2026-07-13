
-- Remove the anon/authenticated-executable SECURITY DEFINER PIN function.
-- The sign-in flow now verifies PINs server-side via the service role client.
REVOKE ALL ON FUNCTION public.verify_portal_pin(text) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.verify_portal_pin(text);
DROP FUNCTION IF EXISTS private.verify_portal_pin(text);
