-- Update the certificados-digitais bucket to be public for file access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'certificados-digitais';

-- Create RLS policies for the certificados-digitais bucket
CREATE POLICY "Authenticated users can view certificates" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'certificados-digitais' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can upload certificates" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'certificados-digitais' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete certificates" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'certificados-digitais' 
  AND auth.role() = 'authenticated'
);