
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------- shared helpers ----------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ---------- profiles ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles owner all" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- business settings ----------
CREATE TABLE public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT 'Londoner VIP Services',
  logo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_settings owner all" ON public.business_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER business_settings_updated_at BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- services ----------
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX services_user_idx ON public.services(user_id, active, name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services owner all" ON public.services FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- service prices ----------
CREATE TABLE public.service_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_pence BIGINT NOT NULL CHECK (amount_pence >= 0),
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  EXCLUDE USING gist (
    service_id WITH =,
    tstzrange(valid_from, COALESCE(valid_to, 'infinity'::timestamptz), '[)') WITH &&
  )
);
CREATE INDEX service_prices_lookup_idx ON public.service_prices(service_id, valid_from DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_prices TO authenticated;
GRANT ALL ON public.service_prices TO service_role;
ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_prices owner all" ON public.service_prices FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER service_prices_updated_at BEFORE UPDATE ON public.service_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- receipt counters ----------
CREATE TABLE public.receipt_counters (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_number BIGINT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.receipt_counters TO authenticated;
GRANT ALL ON public.receipt_counters TO service_role;
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipt_counters owner read" ON public.receipt_counters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------- receipts ----------
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT (now()::date),
  customer_name TEXT CHECK (customer_name IS NULL OR length(customer_name) <= 200),
  customer_email TEXT CHECK (customer_email IS NULL OR length(customer_email) <= 320),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 4000),
  subtotal_pence BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_pence >= 0),
  total_pence BIGINT NOT NULL DEFAULT 0 CHECK (total_pence >= 0),
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name_snapshot TEXT,
  business_name_snapshot TEXT,
  logo_path_snapshot TEXT,
  pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','draft','void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, receipt_number)
);
CREATE INDEX receipts_user_created_idx ON public.receipts(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipts owner all" ON public.receipts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER receipts_updated_at BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- receipt items ----------
CREATE TABLE public.receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price_pence BIGINT NOT NULL CHECK (unit_price_pence >= 0),
  line_total_pence BIGINT NOT NULL CHECK (line_total_pence >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX receipt_items_receipt_idx ON public.receipt_items(receipt_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_items TO authenticated;
GRANT ALL ON public.receipt_items TO service_role;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipt_items owner all" ON public.receipt_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- receipt attachments ----------
CREATE TABLE public.receipt_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX receipt_attachments_receipt_idx ON public.receipt_attachments(receipt_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_attachments TO authenticated;
GRANT ALL ON public.receipt_attachments TO service_role;
ALTER TABLE public.receipt_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipt_attachments owner all" ON public.receipt_attachments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- price resolution ----------
CREATE OR REPLACE FUNCTION public.resolve_service_price(_service_id UUID, _at TIMESTAMPTZ)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT sp.amount_pence
  FROM public.service_prices sp
  WHERE sp.service_id = _service_id
    AND sp.valid_from <= _at
    AND (sp.valid_to IS NULL OR sp.valid_to > _at)
  ORDER BY sp.valid_from DESC
  LIMIT 1;
$$;

-- ---------- set a new price, closing the previous interval ----------
CREATE OR REPLACE FUNCTION public.set_service_price(
  _service_id UUID, _amount_pence BIGINT, _valid_from TIMESTAMPTZ
) RETURNS public.service_prices
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid(); _row public.service_prices;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount_pence < 0 THEN RAISE EXCEPTION 'Price must be zero or greater'; END IF;
  PERFORM 1 FROM public.services WHERE id = _service_id AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;

  DELETE FROM public.service_prices
   WHERE service_id = _service_id AND valid_from >= _valid_from;

  UPDATE public.service_prices
     SET valid_to = _valid_from
   WHERE service_id = _service_id
     AND valid_from < _valid_from
     AND (valid_to IS NULL OR valid_to > _valid_from);

  INSERT INTO public.service_prices (service_id, user_id, amount_pence, valid_from)
  VALUES (_service_id, _uid, _amount_pence, _valid_from)
  RETURNING * INTO _row;

  RETURN _row;
END; $$;

-- ---------- atomic receipt creation ----------
CREATE OR REPLACE FUNCTION public.create_receipt(
  _issue_date DATE,
  _customer_name TEXT,
  _customer_email TEXT,
  _notes TEXT,
  _service_id UUID,
  _items JSONB
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
    service_id, service_name_snapshot, business_name_snapshot, logo_path_snapshot
  ) VALUES (
    _uid,
    'RCP-' || lpad(_num::text, 5, '0'),
    COALESCE(_issue_date, now()::date),
    NULLIF(btrim(COALESCE(_customer_name,'')), ''),
    NULLIF(btrim(COALESCE(_customer_email,'')), ''),
    NULLIF(btrim(COALESCE(_notes,'')), ''),
    _service_id, _svc_name,
    COALESCE(_biz.business_name, 'Londoner VIP Services'), _biz.logo_path
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

-- ---------- new user bootstrap ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid UUID;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.business_settings (user_id, business_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'business_name',''), 'Londoner VIP Services'))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.services (user_id, name, description)
  VALUES (NEW.id, 'Sample, Airport Chauffeur Transfer', 'Sample service. Private chauffeur transfer with meet and greet.')
  RETURNING id INTO _sid;
  INSERT INTO public.service_prices (service_id, user_id, amount_pence, valid_from)
  VALUES (_sid, NEW.id, 18500, now() - interval '1 year');

  INSERT INTO public.services (user_id, name, description)
  VALUES (NEW.id, 'Sample, Personal Concierge Day Rate', 'Sample service. Full-day dedicated concierge support.')
  RETURNING id INTO _sid;
  INSERT INTO public.service_prices (service_id, user_id, amount_pence, valid_from)
  VALUES (_sid, NEW.id, 45000, now() - interval '1 year');

  INSERT INTO public.services (user_id, name, description)
  VALUES (NEW.id, 'Sample, Event Reservation Management', 'Sample service. Priority bookings and reservation handling.')
  RETURNING id INTO _sid;
  INSERT INTO public.service_prices (service_id, user_id, amount_pence, valid_from)
  VALUES (_sid, NEW.id, 12500, now() - interval '1 year');

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- storage policies (owner-scoped by first path segment) ----------
CREATE POLICY "own logos read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'business-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own logos write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own logos update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own logos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own attachments read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipt-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own attachments write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipt-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own attachments delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipt-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own pdfs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipt-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own pdfs write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipt-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own pdfs update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipt-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own pdfs delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipt-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
