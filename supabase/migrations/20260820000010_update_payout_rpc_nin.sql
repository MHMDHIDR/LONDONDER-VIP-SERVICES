CREATE OR REPLACE FUNCTION public.create_payout(
  _issue_date DATE DEFAULT NULL,
  _worker_id UUID DEFAULT NULL,
  _notes TEXT DEFAULT NULL,
  _service_id UUID DEFAULT NULL,
  _items JSONB DEFAULT '[]'::jsonb,
  _pa_order_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _num BIGINT;
  _payout_id UUID;
  _subtotal BIGINT := 0;
  _item JSONB;
  _pos INT := 0;
  _qty NUMERIC;
  _unit BIGINT;
  _line BIGINT;
  _biz RECORD;
  _svc_name TEXT;
  _is_admin BOOLEAN;
  _biz_name_final TEXT;
  _worker RECORD;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _worker_id IS NULL THEN RAISE EXCEPTION 'Worker is required'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;
  IF jsonb_array_length(_items) > 100 THEN RAISE EXCEPTION 'Too many line items'; END IF;

  SELECT * INTO _worker FROM public.workers WHERE id = _worker_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker not found';
  END IF;
  IF NOT _worker.active THEN
    RAISE EXCEPTION 'Worker is not active';
  END IF;

  INSERT INTO public.payout_counters (user_id, last_number) VALUES (_uid, 1)
  ON CONFLICT (user_id) DO UPDATE SET last_number = public.payout_counters.last_number + 1
  RETURNING last_number INTO _num;

  SELECT is_admin INTO _is_admin FROM public.profiles WHERE id = _uid;

  -- Get business settings
  SELECT business_name, logo_path INTO _biz
  FROM public.business_settings
  WHERE user_id = (SELECT id FROM public.profiles WHERE is_admin = true LIMIT 1);

  IF _service_id IS NOT NULL THEN
    SELECT name INTO _svc_name FROM public.services WHERE id = _service_id;
    IF _svc_name IS NULL THEN RAISE EXCEPTION 'Service not found'; END IF;
  END IF;

  _biz_name_final := COALESCE(NULLIF(btrim(_biz.business_name), ''), 'Londoner VIP Services');

  INSERT INTO public.payouts (
    user_id, payout_number, issue_date, 
    worker_id, worker_number_snapshot, worker_phone_snapshot, worker_nin_snapshot,
    notes,
    service_id, service_name_snapshot, business_name_snapshot, logo_path_snapshot, pa_order_id
  ) VALUES (
    _uid,
    'LVS-P' || lpad(_num::text, 5, '0'),
    COALESCE(_issue_date, now()::date),
    _worker_id, _worker.worker_number, _worker.phone, _worker.nin,
    NULLIF(btrim(COALESCE(_notes,'')), ''),
    _service_id, _svc_name,
    _biz_name_final, _biz.logo_path,
    NULLIF(btrim(COALESCE(_pa_order_id,'')), '')
  ) RETURNING id INTO _payout_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := COALESCE((_item->>'quantity')::NUMERIC, 0);
    _unit := COALESCE((_item->>'unit_price_pence')::BIGINT, 0);
    IF _qty <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero'; END IF;
    IF _unit < 0 THEN RAISE EXCEPTION 'Unit price must be zero or greater'; END IF;
    IF length(btrim(COALESCE(_item->>'name',''))) = 0 THEN
      RAISE EXCEPTION 'Every line item needs a name';
    END IF;
    _line := round(_qty * _unit)::BIGINT;
    _subtotal := _subtotal + _line;
    
    INSERT INTO public.payout_items (
      payout_id, user_id, position, name, description, quantity, unit_price_pence, line_total_pence
    ) VALUES (
      _payout_id, _uid, _pos, btrim(_item->>'name'),
      NULLIF(btrim(COALESCE(_item->>'description','')), ''), _qty, _unit, _line
    );
    _pos := _pos + 1;
  END LOOP;

  UPDATE public.payouts SET subtotal_pence = _subtotal, total_pence = _subtotal
  WHERE id = _payout_id;

  RETURN _payout_id;
END;
$$;
