-- ---------- tour_progress table ----------
-- One row per user per product tour: the tour version they last completed or dismissed.
-- A tour auto-starts when there is no row or the row's version is older than the tour's.
CREATE TABLE public.tour_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id TEXT NOT NULL CHECK (length(btrim(tour_id)) BETWEEN 1 AND 80),
  version INTEGER NOT NULL CHECK (version >= 1),
  dismissed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tour_id)
);

-- ---------- permissions ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_progress TO authenticated;
GRANT ALL ON public.tour_progress TO service_role;

-- ---------- RLS ----------
ALTER TABLE public.tour_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tour_progress owner all" ON public.tour_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
