-- ============================================
-- SECURITY FIX 1: Role-Based Access Control System
-- ============================================

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'sales_user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Update customers RLS policies to use role-based access
DROP POLICY IF EXISTS "Sales users can view all customers" ON public.customers;

CREATE POLICY "Sales users view own customers"
ON public.customers FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR 
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins view all customers"
ON public.customers FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update storage policies for proper access control
DROP POLICY IF EXISTS "Authenticated users can view KYC documents" ON storage.objects;

CREATE POLICY "Sales users view their customers' documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.customers
    WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Admins view all documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  public.has_role(auth.uid(), 'admin')
);

-- ============================================
-- SECURITY FIX 2: Input Validation - Database Constraints
-- ============================================

-- Fix any existing data that might violate constraints
UPDATE public.customers SET postal_code = NULL WHERE postal_code IS NOT NULL AND postal_code !~ '^\d{5}$';
UPDATE public.customers SET street = NULL WHERE length(street) > 200;
UPDATE public.customers SET city = NULL WHERE length(city) > 100;
UPDATE public.customers SET commercial_register = NULL WHERE length(commercial_register) > 50;

-- Length constraints for customers table
ALTER TABLE public.customers 
ADD CONSTRAINT company_name_length CHECK (length(company_name) <= 200);

ALTER TABLE public.customers 
ADD CONSTRAINT street_length CHECK (street IS NULL OR length(street) <= 200);

ALTER TABLE public.customers 
ADD CONSTRAINT city_length CHECK (city IS NULL OR length(city) <= 100);

ALTER TABLE public.customers 
ADD CONSTRAINT postal_code_format CHECK (postal_code IS NULL OR postal_code ~ '^\d{5}$');

ALTER TABLE public.customers 
ADD CONSTRAINT tax_id_format CHECK (tax_id IS NULL OR tax_id = '' OR tax_id ~ '^\d{11}$');

ALTER TABLE public.customers 
ADD CONSTRAINT vat_id_format CHECK (vat_id IS NULL OR vat_id = '' OR vat_id ~ '^DE\d{9}$');

ALTER TABLE public.customers 
ADD CONSTRAINT commercial_register_length CHECK (commercial_register IS NULL OR length(commercial_register) <= 50);

-- Constraints for authorized_persons table
ALTER TABLE public.authorized_persons 
ADD CONSTRAINT first_name_length CHECK (length(first_name) <= 100);

ALTER TABLE public.authorized_persons 
ADD CONSTRAINT last_name_length CHECK (length(last_name) <= 100);

ALTER TABLE public.authorized_persons 
ADD CONSTRAINT email_length CHECK (email IS NULL OR email = '' OR length(email) <= 255);

ALTER TABLE public.authorized_persons 
ADD CONSTRAINT place_of_birth_length CHECK (place_of_birth IS NULL OR length(place_of_birth) <= 100);

ALTER TABLE public.authorized_persons 
ADD CONSTRAINT id_document_number_length CHECK (id_document_number IS NULL OR length(id_document_number) <= 50);

ALTER TABLE public.authorized_persons 
ADD CONSTRAINT id_issuing_authority_length CHECK (id_document_issuing_authority IS NULL OR length(id_document_issuing_authority) <= 200);

-- Constraints for beneficial_owners table
ALTER TABLE public.beneficial_owners 
ADD CONSTRAINT ownership_range CHECK (ownership_percentage IS NULL OR (ownership_percentage >= 0 AND ownership_percentage <= 100));

ALTER TABLE public.beneficial_owners 
ADD CONSTRAINT bo_first_name_length CHECK (length(first_name) <= 100);

ALTER TABLE public.beneficial_owners 
ADD CONSTRAINT bo_last_name_length CHECK (length(last_name) <= 100);

-- Constraints for SEPA mandates
ALTER TABLE public.sepa_mandates 
ADD CONSTRAINT iban_format CHECK (iban ~ '^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$');

ALTER TABLE public.sepa_mandates 
ADD CONSTRAINT bic_format CHECK (bic IS NULL OR bic = '' OR bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$');

ALTER TABLE public.sepa_mandates 
ADD CONSTRAINT bank_name_length CHECK (bank_name IS NULL OR length(bank_name) <= 200);

ALTER TABLE public.sepa_mandates 
ADD CONSTRAINT account_holder_length CHECK (length(account_holder) <= 200);

-- Validation trigger for input sanitization
CREATE OR REPLACE FUNCTION public.sanitize_text_inputs()
RETURNS TRIGGER AS $$
BEGIN
  -- Sanitize company_name if it exists in the table
  IF TG_TABLE_NAME = 'customers' THEN
    NEW.company_name = regexp_replace(NEW.company_name, '[\x00-\x1F\x7F]', '', 'g');
    IF NEW.street IS NOT NULL THEN
      NEW.street = regexp_replace(NEW.street, '[\x00-\x1F\x7F]', '', 'g');
    END IF;
    IF NEW.city IS NOT NULL THEN
      NEW.city = regexp_replace(NEW.city, '[\x00-\x1F\x7F]', '', 'g');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sanitize_customers_inputs
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.sanitize_text_inputs();

-- ============================================
-- SECURITY FIX 3: Reduce Magic Link Validity to 24 Hours
-- ============================================

-- Create function to generate magic links with 24-hour expiry (instead of 7 days)
CREATE OR REPLACE FUNCTION public.generate_magic_link_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.magic_link_token IS NOT NULL AND (OLD.magic_link_token IS NULL OR OLD.magic_link_token IS DISTINCT FROM NEW.magic_link_token) THEN
    -- Set expiration to 24 hours instead of 7 days
    NEW.magic_link_expires_at = NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_magic_link_expiry
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW
WHEN (NEW.magic_link_token IS NOT NULL)
EXECUTE FUNCTION public.generate_magic_link_token();