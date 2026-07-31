-- Add soft delete to receipts and explicitly create storage buckets
ALTER TABLE public.receipts ADD COLUMN deleted_at TIMESTAMPTZ;

-- Ensure storage buckets exist
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('receipt-pdfs', 'receipt-pdfs', false),
  ('business-logos', 'business-logos', false)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to update ANY receipt so they can soft delete them
CREATE POLICY "receipts admin all" ON public.receipts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
