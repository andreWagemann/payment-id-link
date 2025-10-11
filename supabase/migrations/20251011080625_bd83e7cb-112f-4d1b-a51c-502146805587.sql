-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for legal forms
CREATE TYPE legal_form AS ENUM ('gmbh', 'ag', 'einzelunternehmen', 'ohg', 'kg', 'ug', 'andere');

-- Enum for onboarding status
CREATE TYPE onboarding_status AS ENUM ('draft', 'invited', 'in_progress', 'completed');

-- Customers table (main onboarding entity)
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  legal_form legal_form NOT NULL,
  country TEXT NOT NULL DEFAULT 'DE',
  street TEXT,
  postal_code TEXT,
  city TEXT,
  tax_id TEXT,
  commercial_register TEXT,
  status onboarding_status NOT NULL DEFAULT 'draft',
  magic_link_token TEXT UNIQUE,
  magic_link_expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Authorized persons (Vertretungsberechtigte)
CREATE TABLE public.authorized_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  nationality TEXT,
  email TEXT,
  phone TEXT,
  street TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'DE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Beneficial owners (Wirtschaftlich Berechtigte)
CREATE TABLE public.beneficial_owners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  nationality TEXT,
  ownership_percentage NUMERIC(5,2),
  street TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'DE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document types enum
CREATE TYPE document_type AS ENUM (
  'commercial_register',
  'transparency_register', 
  'articles_of_association',
  'id_document',
  'proof_of_address',
  'other'
);

-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  person_id UUID,
  document_type document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Signatures table with audit trail
CREATE TABLE public.signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  signature_data TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  document_hash TEXT,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_accepted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficial_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Sales users can view all customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales users can create customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Sales users can update their customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Public can view customer via magic link"
  ON public.customers FOR SELECT
  TO anon
  USING (magic_link_token IS NOT NULL AND magic_link_expires_at > NOW());

CREATE POLICY "Public can update customer via magic link"
  ON public.customers FOR UPDATE
  TO anon
  USING (magic_link_token IS NOT NULL AND magic_link_expires_at > NOW());

-- RLS Policies for authorized_persons
CREATE POLICY "Sales users can view authorized persons"
  ON public.authorized_persons FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = authorized_persons.customer_id 
    AND created_by = auth.uid()
  ));

CREATE POLICY "Public can manage authorized persons via magic link"
  ON public.authorized_persons FOR ALL
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = authorized_persons.customer_id 
    AND magic_link_token IS NOT NULL 
    AND magic_link_expires_at > NOW()
  ));

CREATE POLICY "Sales users can insert authorized persons"
  ON public.authorized_persons FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = authorized_persons.customer_id 
    AND created_by = auth.uid()
  ));

-- RLS Policies for beneficial_owners
CREATE POLICY "Sales users can view beneficial owners"
  ON public.beneficial_owners FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = beneficial_owners.customer_id 
    AND created_by = auth.uid()
  ));

CREATE POLICY "Public can manage beneficial owners via magic link"
  ON public.beneficial_owners FOR ALL
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = beneficial_owners.customer_id 
    AND magic_link_token IS NOT NULL 
    AND magic_link_expires_at > NOW()
  ));

CREATE POLICY "Sales users can insert beneficial owners"
  ON public.beneficial_owners FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = beneficial_owners.customer_id 
    AND created_by = auth.uid()
  ));

-- RLS Policies for documents
CREATE POLICY "Sales users can view documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = documents.customer_id 
    AND created_by = auth.uid()
  ));

CREATE POLICY "Public can manage documents via magic link"
  ON public.documents FOR ALL
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = documents.customer_id 
    AND magic_link_token IS NOT NULL 
    AND magic_link_expires_at > NOW()
  ));

-- RLS Policies for signatures
CREATE POLICY "Sales users can view signatures"
  ON public.signatures FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = signatures.customer_id 
    AND created_by = auth.uid()
  ));

CREATE POLICY "Public can create signature via magic link"
  ON public.signatures FOR INSERT
  TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = signatures.customer_id 
    AND magic_link_token IS NOT NULL 
    AND magic_link_expires_at > NOW()
  ));

-- Storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false);

-- Storage policies
CREATE POLICY "Authenticated users can view KYC documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'kyc-documents');

CREATE POLICY "Public can upload via magic link"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'kyc-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.customers 
      WHERE magic_link_token IS NOT NULL 
      AND magic_link_expires_at > NOW()
    )
  );

CREATE POLICY "Public can view own documents via magic link"
  ON storage.objects FOR SELECT
  TO anon
  USING (
    bucket_id = 'kyc-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.customers 
      WHERE magic_link_token IS NOT NULL 
      AND magic_link_expires_at > NOW()
    )
  );

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_authorized_persons_updated_at
  BEFORE UPDATE ON public.authorized_persons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beneficial_owners_updated_at
  BEFORE UPDATE ON public.beneficial_owners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();