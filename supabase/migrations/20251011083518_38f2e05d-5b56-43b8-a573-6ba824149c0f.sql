-- Add person_id to document_checklist to track person-specific documents
ALTER TABLE public.document_checklist
ADD COLUMN person_id uuid REFERENCES public.authorized_persons(id) ON DELETE CASCADE;

-- Remove unique constraint and add new one that includes person_id
ALTER TABLE public.document_checklist
DROP CONSTRAINT IF EXISTS document_checklist_customer_id_document_type_key;

-- Add new unique constraint that allows multiple entries per document type (for different persons)
ALTER TABLE public.document_checklist
ADD CONSTRAINT document_checklist_unique_per_person 
UNIQUE(customer_id, document_type, person_id);