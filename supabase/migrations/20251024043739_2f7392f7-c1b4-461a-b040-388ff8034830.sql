-- Erstelle RLS Policy für Template-Upload
-- Authentifizierte Benutzer müssen Templates hochladen können

CREATE POLICY "Authenticated users can upload templates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = 'templates');

-- Policy für Update (upsert) von Templates
CREATE POLICY "Authenticated users can update templates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = 'templates');