DROP POLICY IF EXISTS "payout_counters owner insert" ON public.payout_counters;
DROP POLICY IF EXISTS "payout_counters owner update" ON public.payout_counters;
DROP POLICY IF EXISTS "payout_counters owner read" ON public.payout_counters;

CREATE POLICY "payout_counters all access" ON public.payout_counters
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.payout_counters TO authenticated;
