-- Create SEPA mandate table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sepa_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL UNIQUE,
  iban text NOT NULL,
  bic text,
  bank_name text,
  account_holder text NOT NULL,
  mandate_reference text NOT NULL,
  mandate_date date NOT NULL DEFAULT CURRENT_DATE,
  accepted boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sepa_mandates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can manage mandate via magic link" ON public.sepa_mandates;
DROP POLICY IF EXISTS "Sales users can view mandates" ON public.sepa_mandates;

-- Public can manage mandate via magic link
CREATE POLICY "Public can manage mandate via magic link"
ON public.sepa_mandates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = sepa_mandates.customer_id
    AND customers.magic_link_token IS NOT NULL
    AND customers.magic_link_expires_at > now()
  )
);

-- Sales users can view mandates
CREATE POLICY "Sales users can view mandates"
ON public.sepa_mandates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = sepa_mandates.customer_id
    AND customers.created_by = auth.uid()
  )
);

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_sepa_mandates_updated_at ON public.sepa_mandates;

-- Trigger for updated_at
CREATE TRIGGER update_sepa_mandates_updated_at
BEFORE UPDATE ON public.sepa_mandates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();