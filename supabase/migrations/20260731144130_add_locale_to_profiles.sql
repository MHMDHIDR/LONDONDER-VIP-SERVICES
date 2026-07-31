-- Add preferred_locale to profiles table to store language preference (en or ar)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_locale text NOT NULL DEFAULT 'en';

-- Optionally restrict it to known locales
ALTER TABLE public.profiles ADD CONSTRAINT check_preferred_locale CHECK (preferred_locale IN ('en', 'ar'));
