
CREATE POLICY "prod_update" ON public.productions
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_bakery'::public.app_role))
  WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_bakery'::public.app_role));

CREATE POLICY "prod_delete" ON public.productions
  FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_bakery'::public.app_role));

CREATE POLICY "pi_update" ON public.production_ingredients
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_bakery'::public.app_role))
  WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_bakery'::public.app_role));

CREATE POLICY "pi_delete" ON public.production_ingredients
  FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'central_bakery'::public.app_role));
