-- Add updated_by to receipts
ALTER TABLE public.receipts ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add explicit foreign keys to profiles to allow PostgREST to automatically join profile data
ALTER TABLE public.receipts
  ADD CONSTRAINT receipts_creator_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT receipts_updater_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
