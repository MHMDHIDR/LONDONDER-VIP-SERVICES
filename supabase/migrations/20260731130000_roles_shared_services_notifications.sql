-- 1. Add is_admin to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Make the first user an admin if they exist, or allow setting it manually.
UPDATE public.profiles SET is_admin = true WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1);

-- 2. Update Services RLS (Shared Services)
DROP POLICY IF EXISTS "services owner all" ON public.services;
CREATE POLICY "services viewable by all authenticated" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "services modifiable by admins" ON public.services FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Update Service Prices RLS
DROP POLICY IF EXISTS "service_prices owner all" ON public.service_prices;
CREATE POLICY "service_prices viewable by all authenticated" ON public.service_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_prices modifiable by admins" ON public.service_prices FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 3. Update create_receipt RPC to use admin business settings & any service
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

  IF _service_id IS NOT NULL THEN
    -- Services are shared, so we just look it up by ID
    SELECT name INTO _svc_name FROM public.services WHERE id = _service_id;
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

-- Update set_service_price to check for admin role instead of just ownership
CREATE OR REPLACE FUNCTION public.set_service_price(
  _service_id UUID, _amount_pence BIGINT, _valid_from TIMESTAMPTZ
) RETURNS public.service_prices
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _row public.service_prices;
  _is_admin BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount_pence < 0 THEN RAISE EXCEPTION 'Price must be zero or greater'; END IF;

  SELECT is_admin INTO _is_admin FROM public.profiles WHERE id = _uid;
  IF NOT _is_admin THEN RAISE EXCEPTION 'Only admins can set service prices'; END IF;

  PERFORM 1 FROM public.services WHERE id = _service_id;
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

-- 4. Push Subscriptions Table
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX push_subscriptions_user_endpoint_idx ON public.push_subscriptions (user_id, endpoint);
CREATE UNIQUE INDEX push_subscriptions_admin_endpoint_idx ON public.push_subscriptions (is_admin, endpoint) WHERE (is_admin = true);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon;

-- 5. Notifications Table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for admin notifications
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR (user_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)));
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid() OR (user_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)));
GRANT ALL ON public.notifications TO service_role;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- 6. Trigger to notify admin when a normal user adds a receipt
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_receipt()
RETURNS trigger AS $$
DECLARE
  _is_admin BOOLEAN;
  _user_name TEXT;
BEGIN
  SELECT is_admin, full_name INTO _is_admin, _user_name FROM public.profiles WHERE id = NEW.user_id;

  IF NOT _is_admin THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NULL,
      'New Receipt Created 🧾',
      'User ' || COALESCE(_user_name, 'Unknown') || ' has generated a new receipt (' || NEW.receipt_number || ')',
      'new_receipt',
      '/receipts/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_new_receipt_notify_admin
  AFTER INSERT ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_receipt();

-- 7. Trigger to call Edge Function
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.invoke_send_push()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://wobqskfpfvxidfhtlzrg.supabase.co/functions/v1/send-push',
    body := json_build_object('record', row_to_json(NEW))::text,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvYnFza2ZwZnZ4aWRmaHRsenJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0OTE3NjEsImV4cCI6MjEwMTA2Nzc2MX0.ogZ8fkKXnBGVOZ_bGBgEDUH79JxtZ5T-a_mj_UORrbk"}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER send_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.invoke_send_push();
