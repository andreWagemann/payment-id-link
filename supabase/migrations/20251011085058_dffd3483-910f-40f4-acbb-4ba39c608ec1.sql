-- Add transaction fee to products table (each product has its own)
ALTER TABLE public.customer_products
ADD COLUMN transaction_fee numeric(10,2);

-- Remove transaction fees from transaction_fees table, keep only card percentages
ALTER TABLE public.customer_transaction_fees
DROP COLUMN IF EXISTS pos_transaction_fee,
DROP COLUMN IF EXISTS ecommerce_transaction_fee;