-- Add NIN to workers
ALTER TABLE public.workers ADD COLUMN nin TEXT;

-- Add worker_nin_snapshot to payouts
ALTER TABLE public.payouts ADD COLUMN worker_nin_snapshot TEXT;
