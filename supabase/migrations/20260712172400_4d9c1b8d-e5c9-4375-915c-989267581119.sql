
CREATE OR REPLACE FUNCTION public.role_for_location(_loc public.location_type)
RETURNS public.app_role LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _loc
    WHEN 'central_store'::public.location_type THEN 'central_store'::public.app_role
    WHEN 'central_bakery'::public.location_type THEN 'central_bakery'::public.app_role
    WHEN 'branch_1'::public.location_type THEN 'branch_1'::public.app_role
    WHEN 'branch_2'::public.location_type THEN 'branch_2'::public.app_role
  END
$$;
