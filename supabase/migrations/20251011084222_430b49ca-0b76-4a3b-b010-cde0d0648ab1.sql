-- Create pricing table for terminal pricing
CREATE TABLE IF NOT EXISTS public.customer_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Terminal types
  has_mobile_terminal boolean DEFAULT false,
  has_stationary_terminal boolean DEFAULT false,
  
  -- Pricing for mobile terminal
  mobile_monthly_rent numeric(10,2),
  mobile_setup_fee numeric(10,2),
  mobile_shipping_fee numeric(10,2),
  
  -- Pricing for stationary terminal
  stationary_monthly_rent numeric(10,2),
  stationary_setup_fee numeric(10,2),
  stationary_shipping_fee numeric(10,2),
  
  -- Transaction fees (same for both terminal types)
  transaction_fee numeric(10,2),
  girocard_fee_percent numeric(5,2),
  credit_card_fee_percent numeric(5,2),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_pricing ENABLE ROW LEVEL SECURITY;

-- Sales users can manage pricing for their customers
CREATE POLICY "Sales users can manage pricing for their customers"
ON public.customer_pricing
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_pricing.customer_id
    AND customers.created_by = auth.uid()
  )
);

-- Public can view pricing via magic link
CREATE POLICY "Public can view pricing via magic link"
ON public.customer_pricing
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_pricing.customer_id
    AND customers.magic_link_token IS NOT NULL
    AND customers.magic_link_expires_at > now()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_customer_pricing_updated_at
BEFORE UPDATE ON public.customer_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();