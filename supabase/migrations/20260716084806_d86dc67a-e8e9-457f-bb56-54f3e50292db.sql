
CREATE OR REPLACE FUNCTION public.list_delivery_staff()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.list_delivery_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_delivery_staff() TO authenticated;
