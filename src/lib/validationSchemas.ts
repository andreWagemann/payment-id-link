import { z } from "zod";

// German postal code validation
const germanPostalCode = z.string().regex(/^\d{5}$/, "Bitte geben Sie eine gültige 5-stellige Postleitzahl ein");

// German tax ID validation (11 digits)
const germanTaxId = z.string().regex(/^\d{11}$/, "Steuernummer muss 11 Ziffern enthalten").optional().or(z.literal(""));

// VAT ID validation (DE + 9 digits)
const germanVatId = z.string().regex(/^DE\d{9}$/, "USt-IdNr. muss im Format DE123456789 sein").optional().or(z.literal(""));

// IBAN validation (basic check - starts with 2 letters, then 2 digits, then alphanumeric)
export const ibanSchema = z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/, "Ungültiges IBAN-Format");

// Company validation schema
export const companySchema = z.object({
  street: z.string().trim().min(1, "Straße ist erforderlich").max(200, "Straße darf max. 200 Zeichen haben"),
  postal_code: germanPostalCode,
  city: z.string().trim().min(1, "Stadt ist erforderlich").max(100, "Stadt darf max. 100 Zeichen haben"),
  tax_id: germanTaxId,
  vat_id: germanVatId,
  commercial_register: z.string().trim().max(50, "Handelsregisternummer darf max. 50 Zeichen haben").optional(),
});

// Person validation schema
export const personSchema = z.object({
  first_name: z.string().trim().min(1, "Vorname ist erforderlich").max(100, "Vorname darf max. 100 Zeichen haben"),
  last_name: z.string().trim().min(1, "Nachname ist erforderlich").max(100, "Nachname darf max. 100 Zeichen haben"),
  date_of_birth: z.string().optional(),
  nationality: z.string().length(2, "Ländercode muss 2 Zeichen haben").optional(),
  email: z.string().email("Ungültige E-Mail-Adresse").max(255, "E-Mail darf max. 255 Zeichen haben").optional().or(z.literal("")),
  street: z.string().trim().max(200, "Straße darf max. 200 Zeichen haben").optional(),
  postal_code: z.string().trim().max(10, "Postleitzahl darf max. 10 Zeichen haben").optional(),
  city: z.string().trim().max(100, "Stadt darf max. 100 Zeichen haben").optional(),
  country: z.string().optional(),
});

// Authorized person validation schema (with GWG fields)
export const authorizedPersonSchema = z.object({
  first_name: z.string().trim().min(1, "Vorname ist erforderlich").max(100, "Vorname darf max. 100 Zeichen haben"),
  last_name: z.string().trim().min(1, "Nachname ist erforderlich").max(100, "Nachname darf max. 100 Zeichen haben"),
  date_of_birth: z.string().min(1, "Geburtsdatum ist erforderlich"),
  place_of_birth: z.string().trim().min(1, "Geburtsort ist erforderlich").max(100, "Geburtsort darf max. 100 Zeichen haben"),
  nationality: z.string().length(2, "Ländercode muss 2 Zeichen haben"),
  email: z.string().email("Ungültige E-Mail-Adresse").max(255, "E-Mail darf max. 255 Zeichen haben").optional().or(z.literal("")),
  private_street: z.string().trim().min(1, "Privatadresse (Straße) ist erforderlich").max(200, "Straße darf max. 200 Zeichen haben"),
  private_postal_code: z.string().trim().min(1, "Postleitzahl ist erforderlich").max(10, "Postleitzahl darf max. 10 Zeichen haben"),
  private_city: z.string().trim().min(1, "Stadt ist erforderlich").max(100, "Stadt darf max. 100 Zeichen haben"),
  private_country: z.string().length(2, "Ländercode muss 2 Zeichen haben").default("DE"),
  id_document_number: z.string().trim().min(1, "Ausweisnummer ist erforderlich").max(50, "Ausweisnummer darf max. 50 Zeichen haben"),
  id_document_issue_date: z.string().min(1, "Ausstellungsdatum ist erforderlich"),
  id_document_issuing_authority: z.string().trim().min(1, "Ausstellende Behörde ist erforderlich").max(200, "Behörde darf max. 200 Zeichen haben"),
});

// Beneficial owner validation schema
export const beneficialOwnerSchema = personSchema.extend({
  ownership_percentage: z.string()
    .refine((val) => {
      if (!val) return true; // Optional
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, "Beteiligung muss zwischen 0 und 100 liegen")
    .optional(),
});

// SEPA mandate validation schema
export const sepaMandateSchema = z.object({
  iban: ibanSchema,
  bic: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, "Ungültiges BIC-Format").optional().or(z.literal("")),
  bank_name: z.string().trim().min(1, "Bankname ist erforderlich").max(200, "Bankname darf max. 200 Zeichen haben"),
  account_holder: z.string().trim().min(1, "Kontoinhaber ist erforderlich").max(200, "Kontoinhaber darf max. 200 Zeichen haben"),
  accepted: z.boolean().refine((val) => val === true, "Sie müssen das SEPA-Mandat akzeptieren"),
});

// Customer creation schema (NewCustomer.tsx)
export const newCustomerSchema = z.object({
  company_name: z.string().trim().min(1, "Firmenname ist erforderlich").max(200, "Firmenname darf max. 200 Zeichen haben"),
  legal_form: z.enum(["gmbh", "ag", "einzelunternehmen", "ohg", "kg", "ug", "andere"], {
    errorMap: () => ({ message: "Bitte wählen Sie eine Rechtsform" }),
  }),
  country: z.string().length(2, "Ländercode muss 2 Zeichen haben").default("DE"),
});

// Product validation schema
export const productSchema = z.object({
  product_type: z.enum(["mobile_terminal", "stationary_terminal", "softpos", "ecommerce"]),
  quantity: z.number().int().min(1, "Menge muss mindestens 1 sein").max(999, "Menge darf max. 999 sein"),
  monthly_rent: z.string()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    }, "Monatsmiete muss eine positive Zahl sein")
    .optional(),
  setup_fee: z.string()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    }, "Einrichtungsgebühr muss eine positive Zahl sein")
    .optional(),
  shipping_fee: z.string()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    }, "Versandgebühr muss eine positive Zahl sein")
    .optional(),
  transaction_fee: z.string()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    }, "Transaktionspreis muss eine positive Zahl sein")
    .optional(),
});

// Card fees validation schema
export const cardFeesSchema = z.object({
  pos_girocard_fee_percent: z.string()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, "Gebühr muss zwischen 0 und 100 liegen")
    .optional(),
  pos_credit_card_fee_percent: z.string()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, "Gebühr muss zwischen 0 und 100 liegen")
    .optional(),
  ecommerce_girocard_fee_percent: z.string()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, "Gebühr muss zwischen 0 und 100 liegen")
    .optional(),
  ecommerce_credit_card_fee_percent: z.string()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, "Gebühr muss zwischen 0 und 100 liegen")
    .optional(),
});
