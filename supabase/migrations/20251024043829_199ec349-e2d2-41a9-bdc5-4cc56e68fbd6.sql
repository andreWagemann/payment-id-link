-- Policy für DELETE von Templates (wird für upsert benötigt)
CREATE POLICY "Authenticated users can delete templates"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = 'templates');