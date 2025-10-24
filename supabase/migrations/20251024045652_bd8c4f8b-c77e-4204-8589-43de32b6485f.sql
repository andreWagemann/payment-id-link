-- Erweitere die Policy für Admins und Sales Users
DROP POLICY IF EXISTS "Sales users can view documents" ON documents;

CREATE POLICY "Sales users and admins can view documents" 
ON documents 
FOR SELECT 
USING (
  -- Admins können alles sehen
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Sales Users können ihre eigenen Kunden-Dokumente sehen
  EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = documents.customer_id 
    AND customers.created_by = auth.uid()
  )
);