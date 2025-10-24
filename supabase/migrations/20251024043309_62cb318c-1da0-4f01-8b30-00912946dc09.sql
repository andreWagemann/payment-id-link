-- Erstelle RLS Policy für Storage Object Access für Templates
-- Die Edge Function benötigt Lesezugriff auf das Contract-Template

-- Policy für Lesezugriff auf Templates im kyc-documents Bucket
CREATE POLICY "Service role can read templates"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = 'templates');

-- Policy für authenticated users (Sales Team) um Templates zu verwalten
CREATE POLICY "Authenticated users can read templates"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = 'templates');
