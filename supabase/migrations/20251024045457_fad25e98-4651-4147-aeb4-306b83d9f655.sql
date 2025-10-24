-- Erlaube Sales-Usern das Lesen von Dokumenten ihrer Kunden
DROP POLICY IF EXISTS "Sales users can view documents" ON documents;

CREATE POLICY "Sales users can view documents" 
ON documents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = documents.customer_id 
    AND customers.created_by = auth.uid()
  )
);