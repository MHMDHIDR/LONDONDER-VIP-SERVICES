-- Fix create_receipt to properly resolve dynamic prefix and save business_name_snapshot
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
  _is_admin BOOLEAN;
  _biz_name_final TEXT;
  _prefix TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;
  IF jsonb_array_length(_items) > 100 THEN RAISE EXCEPTION 'Too many line items'; END IF;

  INSERT INTO public.receipt_counters (user_id, last_number) VALUES (_uid, 1)
  ON CONFLICT (user_id) DO UPDATE SET last_number = public.receipt_counters.last_number + 1
  RETURNING last_number INTO _num;

  SELECT is_admin INTO _is_admin FROM public.profiles WHERE id = _uid;

  -- Get business settings: Prefer the user's settings, fallback to admin settings.
  SELECT business_name, logo_path INTO _biz
  FROM public.business_settings
  WHERE user_id = _uid
     OR user_id = (SELECT id FROM public.profiles WHERE is_admin = true LIMIT 1)
  ORDER BY (user_id = _uid) DESC
  LIMIT 1;

  -- Ensure we have a string for the business name
  _biz_name_final := COALESCE(NULLIF(btrim(_biz.business_name), ''), 'London VIP Services');

  -- Generate dynamic prefix from initials (e.g. "London VIP Services" -> "LVS")
  SELECT string_agg(upper(substring(word FROM 1 FOR 1)), '') INTO _prefix
  FROM regexp_split_to_table(_biz_name_final, '\s+') AS word
  WHERE word <> '';

  -- Default to 'RCP' if empty for some reason
  _prefix := COALESCE(NULLIF(_prefix, ''), 'RCP');

  SELECT name INTO _svc_name FROM public.services WHERE id = _service_id;

  INSERT INTO public.receipts (
    user_id,
    receipt_number,
    issue_date,
    customer_name,
    customer_email,
    notes,
    business_name_snapshot,
    logo_path_snapshot,
    service_id,
    service_name_snapshot,
    pa_order_id,
    subtotal_pence,
    total_pence
  ) VALUES (
    _uid,
    _prefix || '-' || lpad(_num::text, 5, '0'),
    _issue_date,
    _customer_name,
    _customer_email,
    _notes,
    _biz_name_final,
    _biz.logo_path,
    _service_id,
    _svc_name,
    _pa_order_id,
    0, 0
  ) RETURNING id INTO _receipt_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'qty')::NUMERIC;
    _unit := (_item->>'unit_price_pence')::BIGINT;
    _line := round(_qty * _unit);
    _subtotal := _subtotal + _line;

    INSERT INTO public.receipt_items (
      receipt_id,
      position,
      description,
      qty,
      unit_price_pence,
      line_total_pence
    ) VALUES (
      _receipt_id,
      _pos,
      _item->>'description',
      _qty,
      _unit,
      _line
    );
    _pos := _pos + 1;
  END LOOP;

  UPDATE public.receipts
  SET subtotal_pence = _subtotal,
      total_pence = _subtotal
  WHERE id = _receipt_id;

  RETURN _receipt_id;
END;
$$;
