-- ---------- workers sequence ----------
CREATE SEQUENCE public.worker_number_seq START 1001;
GRANT USAGE ON SEQUENCE public.worker_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.worker_number_seq TO service_role;

-- ---------- workers table ----------
CREATE TABLE public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_number INTEGER NOT NULL DEFAULT nextval('public.worker_number_seq'),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  phone TEXT NOT NULL CHECK (length(btrim(phone)) BETWEEN 1 AND 30),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worker_number)
);

-- ---------- indexes ----------
CREATE INDEX workers_active_name_idx ON public.workers(active, name);

-- ---------- permissions ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;

-- ---------- RLS ----------
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workers viewable by all authenticated" ON public.workers 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "workers modifiable by admins" ON public.workers 
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ---------- triggers ----------
CREATE TRIGGER workers_updated_at BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
