-- Update transaction fees table to separate POS and eCommerce fees
ALTER TABLE public.customer_transaction_fees
DROP COLUMN IF EXISTS transaction_fee,
DROP COLUMN IF EXISTS girocard_fee_percent,
DROP COLUMN IF EXISTS credit_card_fee_percent;

-- Add separate columns for POS and eCommerce
ALTER TABLE public.customer_transaction_fees
ADD COLUMN pos_transaction_fee numeric(10,2),
ADD COLUMN pos_girocard_fee_percent numeric(5,2),
ADD COLUMN pos_credit_card_fee_percent numeric(5,2),
ADD COLUMN ecommerce_transaction_fee numeric(10,2),
ADD COLUMN ecommerce_girocard_fee_percent numeric(5,2),
ADD COLUMN ecommerce_credit_card_fee_percent numeric(5,2);