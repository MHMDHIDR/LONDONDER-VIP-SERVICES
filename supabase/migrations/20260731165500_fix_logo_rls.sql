-- Fix logo RLS: allow all authenticated users to read business logos
DROP POLICY IF EXISTS "own logos read" ON storage.objects;

CREATE POLICY "logos viewable by all authenticated" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'business-logos');
