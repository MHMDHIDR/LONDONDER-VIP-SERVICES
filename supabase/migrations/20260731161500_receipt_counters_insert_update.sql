-- Add missing RLS policies for receipt_counters to allow inserts and updates

CREATE POLICY "receipt_counters owner insert" ON public.receipt_counters 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "receipt_counters owner update" ON public.receipt_counters 
FOR UPDATE TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
