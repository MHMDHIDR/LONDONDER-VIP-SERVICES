-- Make resolve_service_price bulletproof by falling back to the earliest known price 
-- if the requested date is before the service price history started.

CREATE OR REPLACE FUNCTION public.resolve_service_price(_service_id UUID, _at TIMESTAMPTZ)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(
    (
      SELECT sp.amount_pence
      FROM public.service_prices sp
      WHERE sp.service_id = _service_id
        AND sp.valid_from <= COALESCE(_at, now())
        AND (sp.valid_to IS NULL OR sp.valid_to > COALESCE(_at, now()))
      ORDER BY sp.valid_from DESC
      LIMIT 1
    ),
    (
      SELECT sp.amount_pence
      FROM public.service_prices sp
      WHERE sp.service_id = _service_id
      ORDER BY sp.valid_from ASC
      LIMIT 1
    )
  );
$$;
