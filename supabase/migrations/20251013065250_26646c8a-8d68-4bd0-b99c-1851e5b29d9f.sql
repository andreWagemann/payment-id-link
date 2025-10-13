-- Add GWG (Geldwäschegesetz) required fields to authorized_persons table
ALTER TABLE public.authorized_persons
ADD COLUMN IF NOT EXISTS place_of_birth text,
ADD COLUMN IF NOT EXISTS private_street text,
ADD COLUMN IF NOT EXISTS private_postal_code text,
ADD COLUMN IF NOT EXISTS private_city text,
ADD COLUMN IF NOT EXISTS private_country text DEFAULT 'DE',
ADD COLUMN IF NOT EXISTS id_document_number text,
ADD COLUMN IF NOT EXISTS id_document_issue_date date,
ADD COLUMN IF NOT EXISTS id_document_issuing_authority text;

COMMENT ON COLUMN public.authorized_persons.place_of_birth IS 'Geburtsort der vertretungsberechtigten Person';
COMMENT ON COLUMN public.authorized_persons.private_street IS 'Privatadresse: Straße und Hausnummer';
COMMENT ON COLUMN public.authorized_persons.private_postal_code IS 'Privatadresse: Postleitzahl';
COMMENT ON COLUMN public.authorized_persons.private_city IS 'Privatadresse: Stadt';
COMMENT ON COLUMN public.authorized_persons.private_country IS 'Privatadresse: Land';
COMMENT ON COLUMN public.authorized_persons.id_document_number IS 'Ausweisnummer';
COMMENT ON COLUMN public.authorized_persons.id_document_issue_date IS 'Datum der Ausstellung des Ausweises';
COMMENT ON COLUMN public.authorized_persons.id_document_issuing_authority IS 'Ausstellende Behörde';