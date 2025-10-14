-- Fix search_path for all functions to prevent security issues

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Fix sanitize_text_inputs function
CREATE OR REPLACE FUNCTION public.sanitize_text_inputs()
RETURNS TRIGGER AS $$
BEGIN
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
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Fix generate_magic_link_token function
CREATE OR REPLACE FUNCTION public.generate_magic_link_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.magic_link_token IS NOT NULL AND (OLD.magic_link_token IS NULL OR OLD.magic_link_token IS DISTINCT FROM NEW.magic_link_token) THEN
    NEW.magic_link_expires_at = NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;