
DROP POLICY IF EXISTS movements_insert ON public.inventory_movements;

CREATE POLICY movements_insert ON public.inventory_movements
FOR INSERT
WITH CHECK (
  performed_by = auth.uid()
  AND (
    private.is_admin(auth.uid())
    -- Central store records inbound (supplier_in) and outbound movements from its own location
    OR (private.has_role(auth.uid(), 'central_store'::public.app_role) AND location = 'central_store'::public.location_type)
    -- Central bakery records production and movements at its location
    OR (private.has_role(auth.uid(), 'central_bakery'::public.app_role) AND location = 'central_bakery'::public.location_type)
    -- Branches record inbound movements at their own branch (e.g. received deliveries)
    OR (private.has_role(auth.uid(), 'branch_1'::public.app_role) AND location = 'branch_1'::public.location_type)
    OR (private.has_role(auth.uid(), 'branch_2'::public.app_role) AND location = 'branch_2'::public.location_type)
    -- Delivery man may record OUT from source and IN at destination for their assigned request
    OR (
      private.has_role(auth.uid(), 'delivery_man'::public.app_role)
      AND reference_type = 'request'
      AND EXISTS (
        SELECT 1 FROM public.requests r
        WHERE r.id = reference_id
          AND r.delivery_man_id = auth.uid()
          AND (
            (location = r.from_location AND movement = 'delivery_out'::public.movement_type)
            OR (location = r.to_location AND movement = 'delivery_in'::public.movement_type)
          )
      )
    )
  )
);
