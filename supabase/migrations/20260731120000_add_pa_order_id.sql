ALTER TABLE public.receipts ADD COLUMN pa_order_id TEXT;

CREATE OR REPLACE FUNCTION public.create_receipt(
  _issue_date DATE,
  _customer_name TEXT,
  _customer_email TEXT,
  _notes TEXT,
  _service_id UUID,
  _items JSONB,
  _pa_order_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _num BIGINT;
  _receipt_id UUID;
  _subtotal BIGINT := 0;
  _item JSONB;
  _pos INT := 0;
  _qty NUMERIC;
  _unit BIGINT;
  _line BIGINT;
  _biz RECORD;
  _svc_name TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;
  IF jsonb_array_length(_items) > 100 THEN RAISE EXCEPTION 'Too many line items'; END IF;

  INSERT INTO public.receipt_counters (user_id, last_number) VALUES (_uid, 1)
  ON CONFLICT (user_id) DO UPDATE SET last_number = public.receipt_counters.last_number + 1
  RETURNING last_number INTO _num;

  SELECT business_name, logo_path INTO _biz FROM public.business_settings WHERE user_id = _uid;

  IF _service_id IS NOT NULL THEN
    SELECT name INTO _svc_name FROM public.services WHERE id = _service_id AND user_id = _uid;
    IF _svc_name IS NULL THEN RAISE EXCEPTION 'Service not found'; END IF;
  END IF;

  INSERT INTO public.receipts (
    user_id, receipt_number, issue_date, customer_name, customer_email, notes,
    service_id, service_name_snapshot, business_name_snapshot, logo_path_snapshot, pa_order_id
  ) VALUES (
    _uid,
    'RCP-' || lpad(_num::text, 5, '0'),
    COALESCE(_issue_date, now()::date),
    NULLIF(btrim(COALESCE(_customer_name,'')), ''),
    NULLIF(btrim(COALESCE(_customer_email,'')), ''),
    NULLIF(btrim(COALESCE(_notes,'')), ''),
    _service_id, _svc_name,
    COALESCE(_biz.business_name, 'London VIP Services'), _biz.logo_path,
    NULLIF(btrim(COALESCE(_pa_order_id,'')), '')
  ) RETURNING id INTO _receipt_id;

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
    INSERT INTO public.receipt_items (
      receipt_id, user_id, position, name, description, quantity, unit_price_pence, line_total_pence
    ) VALUES (
      _receipt_id, _uid, _pos, btrim(_item->>'name'),
      NULLIF(btrim(COALESCE(_item->>'description','')), ''), _qty, _unit, _line
    );
    _pos := _pos + 1;
  END LOOP;

  UPDATE public.receipts SET subtotal_pence = _subtotal, total_pence = _subtotal
   WHERE id = _receipt_id;

  RETURN _receipt_id;
END; $$;
