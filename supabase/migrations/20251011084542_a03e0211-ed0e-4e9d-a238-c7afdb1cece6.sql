-- Drop old pricing table
DROP TABLE IF EXISTS public.customer_pricing CASCADE;

-- Create product types enum
CREATE TYPE product_type AS ENUM ('mobile_terminal', 'stationary_terminal', 'softpos', 'ecommerce');

-- Create products table for customer products with quantities
CREATE TABLE public.customer_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  product_type product_type NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  monthly_rent numeric(10,2),
  setup_fee numeric(10,2),
  shipping_fee numeric(10,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create pricing table for transaction fees (one per customer)
CREATE TABLE public.customer_transaction_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL UNIQUE,
  transaction_fee numeric(10,2),
  girocard_fee_percent numeric(5,2),
  credit_card_fee_percent numeric(5,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on products
ALTER TABLE public.customer_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales users can manage products for their customers"
ON public.customer_products
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_products.customer_id
    AND customers.created_by = auth.uid()
  )
);

CREATE POLICY "Public can view products via magic link"
ON public.customer_products
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_products.customer_id
    AND customers.magic_link_token IS NOT NULL
    AND customers.magic_link_expires_at > now()
  )
);

-- Enable RLS on transaction fees
ALTER TABLE public.customer_transaction_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales users can manage fees for their customers"
ON public.customer_transaction_fees
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_transaction_fees.customer_id
    AND customers.created_by = auth.uid()
  )
);

CREATE POLICY "Public can view fees via magic link"
ON public.customer_transaction_fees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_transaction_fees.customer_id
    AND customers.magic_link_token IS NOT NULL
    AND customers.magic_link_expires_at > now()
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_customer_products_updated_at
BEFORE UPDATE ON public.customer_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_transaction_fees_updated_at
BEFORE UPDATE ON public.customer_transaction_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();