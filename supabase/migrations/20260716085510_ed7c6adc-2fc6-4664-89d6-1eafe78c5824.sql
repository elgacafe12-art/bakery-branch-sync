
-- 1) damage_logs: restrict INSERT to reporter's own location (or admin/store/bakery)
DROP POLICY IF EXISTS "Reporters can insert their own damage logs" ON public.damage_logs;
CREATE POLICY "Reporters can insert their own damage logs"
ON public.damage_logs FOR INSERT TO authenticated
WITH CHECK (
  reporter_id = auth.uid()
  AND (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'central_store'::public.app_role)
    OR private.has_role(auth.uid(), 'central_bakery'::public.app_role)
    OR private.user_location(auth.uid()) = location
  )
);

-- 2) list_delivery_staff: switch to SECURITY INVOKER; grant readers targeted SELECT on user_roles/profiles
CREATE POLICY user_roles_delivery_staff_visible
ON public.user_roles FOR SELECT TO authenticated
USING (
  role = 'delivery_man'::public.app_role
  AND (
    private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'central_store'::public.app_role)
    OR private.has_role(auth.uid(), 'central_bakery'::public.app_role)
  )
);

CREATE POLICY profiles_delivery_staff_visible
ON public.profiles FOR SELECT TO authenticated
USING (
  (private.is_admin(auth.uid())
    OR private.has_role(auth.uid(), 'central_store'::public.app_role)
    OR private.has_role(auth.uid(), 'central_bakery'::public.app_role))
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.id AND ur.role = 'delivery_man'::public.app_role
  )
);

CREATE OR REPLACE FUNCTION public.list_delivery_staff()
 RETURNS TABLE(id uuid, full_name text)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'delivery_man'::public.app_role
    AND (
      private.is_admin(auth.uid())
      OR private.has_role(auth.uid(), 'central_store'::public.app_role)
      OR private.has_role(auth.uid(), 'central_bakery'::public.app_role)
    )
  ORDER BY p.full_name;
$function$;
