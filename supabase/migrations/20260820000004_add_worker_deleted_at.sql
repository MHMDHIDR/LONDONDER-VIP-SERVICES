ALTER TABLE public.workers ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE OR REPLACE VIEW public.active_workers AS
  SELECT * FROM public.workers WHERE deleted_at IS NULL;
