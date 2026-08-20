-- Allow authenticated users to insert and update their own payout counter row
CREATE POLICY "payout_counters owner insert" ON public.payout_counters
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "payout_counters owner update" ON public.payout_counters
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Also grant INSERT and UPDATE privileges (only SELECT was granted before)
GRANT INSERT, UPDATE ON public.payout_counters TO authenticated;
