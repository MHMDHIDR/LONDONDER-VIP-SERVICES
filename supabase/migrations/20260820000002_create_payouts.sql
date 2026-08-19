-- ---------- payout counters ----------
CREATE TABLE public.payout_counters (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_number BIGINT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.payout_counters TO authenticated;
GRANT ALL ON public.payout_counters TO service_role;
ALTER TABLE public.payout_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_counters owner read" ON public.payout_counters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---------- payouts ----------
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  worker_number_snapshot INTEGER,
  worker_phone_snapshot TEXT,
  payout_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT (now()::date),
  pa_order_id TEXT,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name_snapshot TEXT,
  business_name_snapshot TEXT,
  logo_path_snapshot TEXT,
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 4000),
  subtotal_pence BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_pence >= 0),
  total_pence BIGINT NOT NULL DEFAULT 0 CHECK (total_pence >= 0),
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','draft','void')),
  pdf_path TEXT,
  deleted_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, payout_number)
);
CREATE INDEX payouts_user_created_idx ON public.payouts(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts owner read" ON public.payouts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "payouts owner insert" ON public.payouts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payouts admin read" ON public.payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "payouts admin update" ON public.payouts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "payouts admin delete" ON public.payouts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE TRIGGER payouts_updated_at BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- payout items ----------
CREATE TABLE public.payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price_pence BIGINT NOT NULL CHECK (unit_price_pence >= 0),
  line_total_pence BIGINT NOT NULL CHECK (line_total_pence >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payout_items_payout_idx ON public.payout_items(payout_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_items TO authenticated;
GRANT ALL ON public.payout_items TO service_role;
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_items owner all" ON public.payout_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- payout attachments ----------
CREATE TABLE public.payout_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payout_attachments_payout_idx ON public.payout_attachments(payout_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_attachments TO authenticated;
GRANT ALL ON public.payout_attachments TO service_role;
ALTER TABLE public.payout_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_attachments owner all" ON public.payout_attachments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- storage buckets and policies ----------
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('payout-pdfs', 'payout-pdfs', false),
  ('payout-attachments', 'payout-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "own payout attachments read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payout-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own payout attachments write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payout-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own payout attachments delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payout-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own payout pdfs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payout-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own payout pdfs write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payout-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own payout pdfs update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payout-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own payout pdfs delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payout-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
