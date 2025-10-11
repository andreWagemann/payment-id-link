-- Create document checklist table to track which documents are required and available
CREATE TABLE IF NOT EXISTS public.document_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  document_type document_type NOT NULL,
  marked_as_available boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, document_type)
);

-- Enable RLS
ALTER TABLE public.document_checklist ENABLE ROW LEVEL SECURITY;

-- Sales users can manage checklist for their customers
CREATE POLICY "Sales users can manage checklist for their customers"
ON public.document_checklist
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = document_checklist.customer_id
    AND customers.created_by = auth.uid()
  )
);

-- Public can view checklist via magic link
CREATE POLICY "Public can view checklist via magic link"
ON public.document_checklist
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = document_checklist.customer_id
    AND customers.magic_link_token IS NOT NULL
    AND customers.magic_link_expires_at > now()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_document_checklist_updated_at
BEFORE UPDATE ON public.document_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();