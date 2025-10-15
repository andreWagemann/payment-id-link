-- Add delete policy for customers table
CREATE POLICY "Sales users can delete their customers"
ON public.customers
FOR DELETE
USING (auth.uid() = created_by);