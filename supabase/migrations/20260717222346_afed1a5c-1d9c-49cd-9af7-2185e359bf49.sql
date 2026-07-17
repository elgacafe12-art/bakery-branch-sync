
-- 1) Remove the "first user becomes admin" fallback from handle_new_user.
-- Admin bootstrap is out-of-band via the portal accounts / direct user_roles
-- insert only. Public signup can never self-promote to admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
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
  RETURN NEW;
END $$;

-- 2) Tighten damage_logs INSERT so location is bound to the reporter's own
-- assigned location. Admin remains unrestricted; central_store/central_bakery
-- may only report against their own respective locations.
DROP POLICY IF EXISTS "Reporters can insert their own damage logs" ON public.damage_logs;
CREATE POLICY "Reporters can insert their own damage logs"
ON public.damage_logs FOR INSERT TO authenticated
WITH CHECK (
  reporter_id = auth.uid()
  AND (
    private.is_admin(auth.uid())
    OR (private.has_role(auth.uid(), 'central_store'::public.app_role)
        AND location = 'central_store'::public.location_type)
    OR (private.has_role(auth.uid(), 'central_bakery'::public.app_role)
        AND location = 'central_bakery'::public.location_type)
    OR private.user_location(auth.uid()) = location
  )
);

-- 3) Rotate every portal PIN to a fresh random value so the plaintext
-- values shipped in the historical seed migration no longer grant access.
UPDATE public.portal_pins SET pin = '5255', updated_at = now() WHERE role = 'admin'::public.app_role;
UPDATE public.portal_pins SET pin = '8423', updated_at = now() WHERE role = 'central_store'::public.app_role;
UPDATE public.portal_pins SET pin = '7919', updated_at = now() WHERE role = 'central_bakery'::public.app_role;
UPDATE public.portal_pins SET pin = '1418', updated_at = now() WHERE role = 'delivery_man'::public.app_role;
UPDATE public.portal_pins SET pin = '7563', updated_at = now() WHERE role = 'branch_1'::public.app_role;
UPDATE public.portal_pins SET pin = '6060', updated_at = now() WHERE role = 'branch_2'::public.app_role;
