import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { customerId } = await req.json();
    console.log("Generating contract for customer:", customerId);

    // Lade Kundendaten
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (customerError) {
      console.error("Error loading customer:", customerError);
      throw new Error("Kunde nicht gefunden");
    }

    // Lade vertretungsberechtigte Personen
    const { data: authorizedPersons } = await supabase
      .from("authorized_persons")
      .select("*")
      .eq("customer_id", customerId);

    // Lade wirtschaftlich Berechtigte
    const { data: beneficialOwners } = await supabase
      .from("beneficial_owners")
      .select("*")
      .eq("customer_id", customerId);

    // Lade SEPA-Mandat
    const { data: sepaMandate } = await supabase
      .from("sepa_mandates")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle();

    // Lade Unterschrift
    const { data: signature } = await supabase
      .from("signatures")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle();

    // Lade Produkte
    const { data: products } = await supabase.from("customer_products").select("*").eq("customer_id", customerId);

    console.log("Loaded customer data, loading template...");

    // Lade PDF-Template aus dem Storage
    const { data: templateData, error: downloadError } = await supabase.storage
      .from("kyc-documents")
      .download("templates/contract-template.pdf");

    if (downloadError) {
      console.error("Error downloading template:", downloadError);
      throw new Error("Template konnte nicht geladen werden: " + JSON.stringify(downloadError));
    }

    if (!templateData) {
      throw new Error("Template ist leer");
    }

    console.log("Template loaded, parsing PDF...");
    const templateBytes = await templateData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);

    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 9;

    // ===== Layout-Helfer: A4 & Spalten =====
    function grid(page: any) {
      const { width, height } = page.getSize(); // A4 ≈ 595 x 842pt
      return {
        height,
        // Spalten links -> rechts: Labels stehen links im Druckbild; Wertefelder starten im Raster:
        COL_L:  72,   // linker Rand ~25 mm
        COL_M1: 150,  // Wertefeld 1
        COL_M2: 300,  // Wertefeld 2
        COL_R:  460,  // Wertefeld 3/4 rechts
      };
    }

    // =====================
    // Seite 1 – Kontakt + Vertreter
    // =====================
    const page1 = pages[0];
    const G1 = grid(page1);

    // --- 1) Kontaktinformationen (Block beginnt visuell ~120 mm von oben) ---
    // Baselines
    const Y_CONTACT_TITLE = G1.height - 170;     // "1. Kontaktinformationen" (Referenz, wir schreiben nur Werte)
    const Y_COMPANY       = Y_CONTACT_TITLE - 26; // Zeile: Kundenname / Rechtsform
    const Y_ADDRESS       = Y_COMPANY - 24;       // Zeile: Firmenadresse
    const Y_CONTACT       = Y_ADDRESS - 28;       // Zeile: Ansprechpartner

    // Kundenname / Rechtsform
    page1.drawText(customer.company_name ?? "", { x: G1.COL_M1, y: Y_COMPANY, size: 9, font });
    page1.drawText((customer.legal_form ?? "").toUpperCase(), { x: G1.COL_R, y: Y_COMPANY, size: 9, font });

    // Firmenadresse: Straße | PLZ | Stadt | Ländercode
    page1.drawText(customer.street ?? "",       { x: G1.COL_M1, y: Y_ADDRESS, size: 9, font });
    page1.drawText(customer.postal_code ?? "",  { x: G1.COL_M2, y: Y_ADDRESS, size: 9, font });
    page1.drawText(customer.city ?? "",         { x: G1.COL_M2 + 50, y: Y_ADDRESS, size: 9, font });
    page1.drawText(customer.country || "DE",    { x: G1.COL_R,  y: Y_ADDRESS, size: 9, font });

    // Ansprechpartner: Vorname | Nachname | E-Mail | Telefon
    if (authorizedPersons?.length) {
      const p = authorizedPersons[0];
      page1.drawText(p.first_name ?? "", { x: G1.COL_M1, y: Y_CONTACT, size: 8, font });
      page1.drawText(p.last_name  ?? "", { x: G1.COL_M1 + 90, y: Y_CONTACT, size: 8, font });
      page1.drawText(p.email ?? "",      { x: G1.COL_M2 + 90, y: Y_CONTACT, size: 8, font });
      // Telefonfeld ist im Formular vorgesehen; falls vorhanden:
      if (p.phone) page1.drawText(p.phone, { x: G1.COL_R, y: Y_CONTACT, size: 8, font });
    }

    // --- 2) Rechtliche Vertreter (Block beginnt unterhalb Checkboxen) ---
    const Y_REP_HDR            = Y_CONTACT - 34;   // Zeile mit Auswahl "juristische Person" etc.
    const Y_REP_CHECKS         = Y_REP_HDR - 16;

    // Checkboxen: Kunde ist juristische Person; Einzelvertretungsberechtigung
    page1.drawText("X", { x: G1.COL_M2 + 10, y: Y_REP_HDR, size: 9, font }); // "juristische Person"
    page1.drawText("X", { x: G1.COL_L + 8,  y: Y_REP_CHECKS, size: 9, font }); // "Einzelvertretungsberechtigung"

    // Vertreter 1 – Zeilenabstand 15 pt
    const Y_V1_LINE1 = Y_REP_CHECKS - 22; // Anrede / Vorname / Nachname
    const Y_V1_LINE2 = Y_V1_LINE1 - 15;   // Geburtsort / Geburtsdatum / Nationalität
    const Y_V1_LINE3 = Y_V1_LINE2 - 15;   // Privatadresse: Straße / PLZ / Stadt / Land
    const Y_V1_LINE4 = Y_V1_LINE3 - 15;   // Ausweisdokument / Nummer / Ausstellungsdatum / Behörde
    const Y_V1_LINE5 = Y_V1_LINE4 - 15;   // E-Mail
    const small = 8;

    if (authorizedPersons?.[0]) {
      const a = authorizedPersons[0];
      // Anrede fix auf "Herr" laut Beispiel
      page1.drawText("Herr",                { x: G1.COL_L + 35, y: Y_V1_LINE1, size: small, font });
      page1.drawText(a.first_name ?? "",    { x: G1.COL_M1,     y: Y_V1_LINE1, size: small, font });
      page1.drawText(a.last_name ?? "",     { x: G1.COL_M1 + 150, y: Y_V1_LINE1, size: small, font });

      page1.drawText(a.place_of_birth ?? "",                                 { x: G1.COL_L + 35, y: Y_V1_LINE2, size: small, font });
      if (a.date_of_birth) page1.drawText(new Date(a.date_of_birth).toLocaleDateString("de-DE"), { x: G1.COL_M1 + 150, y: Y_V1_LINE2, size: small, font });
      if (a.nationality)   page1.drawText(a.nationality,                     { x: G1.COL_R,      y: Y_V1_LINE2, size: small, font });

      page1.drawText(a.private_street ?? "",     { x: G1.COL_M1, y: Y_V1_LINE3, size: small, font });
      page1.drawText(a.private_postal_code ?? "",{ x: G1.COL_M2, y: Y_V1_LINE3, size: small, font });
      page1.drawText(a.private_city ?? "",       { x: G1.COL_M2 + 60, y: Y_V1_LINE3, size: small, font });
      page1.drawText(a.private_country ?? "DE",  { x: G1.COL_R,  y: Y_V1_LINE3, size: small, font });

      page1.drawText("Ausweis", { x: G1.COL_L + 35, y: Y_V1_LINE4, size: small, font });
      if (a.id_document_number)       page1.drawText(a.id_document_number,                            { x: G1.COL_M1 + 60,  y: Y_V1_LINE4, size: small, font });
      if (a.id_document_issue_date)   page1.drawText(new Date(a.id_document_issue_date).toLocaleDateString("de-DE"), { x: G1.COL_M2 + 20,  y: Y_V1_LINE4, size: small, font });
      if (a.id_document_issuing_authority) page1.drawText(a.id_document_issuing_authority,            { x: G1.COL_R,       y: Y_V1_LINE4, size: small, font });

      if (a.email) page1.drawText(a.email, { x: G1.COL_M1 + 25, y: Y_V1_LINE5, size: small, font });
    }

    // Vertreter 2 – gleicher Raster, 90 pt tiefer
    const SHIFT = 90;
    const Y_V2_LINE1 = Y_V1_LINE1 - SHIFT;
    const Y_V2_LINE2 = Y_V1_LINE2 - SHIFT;
    const Y_V2_LINE3 = Y_V1_LINE3 - SHIFT;
    const Y_V2_LINE4 = Y_V1_LINE4 - SHIFT;
    const Y_V2_LINE5 = Y_V1_LINE5 - SHIFT;

    if (authorizedPersons?.[1]) {
      const b = authorizedPersons[1];
      page1.drawText("Herr",               { x: G1.COL_L + 35, y: Y_V2_LINE1, size: small, font });
      page1.drawText(b.first_name ?? "",   { x: G1.COL_M1,     y: Y_V2_LINE1, size: small, font });
      page1.drawText(b.last_name ?? "",    { x: G1.COL_M1 + 150, y: Y_V2_LINE1, size: small, font });

      if (b.place_of_birth) page1.drawText(b.place_of_birth, { x: G1.COL_L + 35, y: Y_V2_LINE2, size: small, font });
      if (b.date_of_birth)  page1.drawText(new Date(b.date_of_birth).toLocaleDateString("de-DE"), { x: G1.COL_M1 + 150, y: Y_V2_LINE2, size: small, font });
      if (b.nationality)    page1.drawText(b.nationality, { x: G1.COL_R, y: Y_V2_LINE2, size: small, font });

      if (b.private_street)      page1.drawText(b.private_street,      { x: G1.COL_M1, y: Y_V2_LINE3, size: small, font });
      if (b.private_postal_code) page1.drawText(b.private_postal_code, { x: G1.COL_M2, y: Y_V2_LINE3, size: small, font });
      if (b.private_city)        page1.drawText(b.private_city,        { x: G1.COL_M2 + 60, y: Y_V2_LINE3, size: small, font });
      if (b.private_country)     page1.drawText(b.private_country,     { x: G1.COL_R, y: Y_V2_LINE3, size: small, font });

      page1.drawText("Ausweis", { x: G1.COL_L + 35, y: Y_V2_LINE4, size: small, font });
      if (b.id_document_number)         page1.drawText(b.id_document_number, { x: G1.COL_M1 + 60, y: Y_V2_LINE4, size: small, font });
      if (b.id_document_issue_date)     page1.drawText(new Date(b.id_document_issue_date).toLocaleDateString("de-DE"), { x: G1.COL_M2 + 20, y: Y_V2_LINE4, size: small, font });
      if (b.id_document_issuing_authority) page1.drawText(b.id_document_issuing_authority, { x: G1.COL_R, y: Y_V2_LINE4, size: small, font });

      if (b.email) page1.drawText(b.email, { x: G1.COL_M1 + 25, y: Y_V2_LINE5, size: small, font });
    }

    // =====================
    // Seite 2 – Wirtschaftlich Berechtigte
    // =====================
    if (pages.length > 1 && beneficialOwners?.length) {
      const page2 = pages[1];
      const G2 = grid(page2);
      // Block-Start liegt im Formular unter der Überschrift auf ca. 285 pt vom oberen Rand
      const BASE = G2.height - 305; // erste Datenzeile
      const STEP = 18;

      beneficialOwners.slice(0, 3).forEach((o, idx) => {
        const y = BASE - idx * STEP;
        page2.drawText(`${o.first_name ?? ""} ${o.last_name ?? ""}`.trim(), { x: G2.COL_M1 - 10, y, size: fontSize, font });
        if (o.date_of_birth) page2.drawText(new Date(o.date_of_birth).toLocaleDateString("de-DE"), { x: G2.COL_M2 - 20, y, size: fontSize, font });
        if (o.nationality)   page2.drawText(o.nationality, { x: G2.COL_R - 60, y, size: fontSize, font });
        page2.drawText(`${o.ownership_percentage ?? 0}%`, { x: G2.COL_R + 40, y, size: fontSize, font });
      });
    }

    // =====================
    // Seite 3 – Produkte
    // =====================
    if (pages.length > 2 && products?.length) {
      const page3 = pages[2];
      const G3 = grid(page3);
      const BASE = G3.height - 260; // oberste Produktzeile
      const STEP = 22;

      products.slice(0, 3).forEach((pr, idx) => {
        const y = BASE - idx * STEP;
        page3.drawText(pr.product_type ?? "",     { x: G3.COL_L + 25, y, size: fontSize, font });
        page3.drawText(String(pr.quantity ?? ""), { x: G3.COL_M1 + 35, y, size: fontSize, font });
        if (pr.monthly_rent != null) page3.drawText(String(pr.monthly_rent), { x: G3.COL_M2 + 20, y, size: fontSize, font });
      });
    }

    // =====================
    // Seite 4 – SEPA + Unterschriften
    // =====================
    if (pages.length > 3) {
      const page4 = pages[3];
      const G4 = grid(page4);

      // SEPA (Punkt 11): Kontoinhaber | IBAN | Bank | BIC (liegen im Formularblock mittig bis rechts)
      if (sepaMandate) {
        const Y_SEPA1 = G4.height - 220;
        const Y_SEPA2 = Y_SEPA1 - 16;

        page4.drawText(sepaMandate.account_holder ?? "", { x: G4.COL_M1 - 25, y: Y_SEPA1, size: fontSize, font }); // Kontoinhaber
        page4.drawText(sepaMandate.iban ?? "",           { x: G4.COL_M2 + 5,  y: Y_SEPA1, size: fontSize, font }); // IBAN

        if (sepaMandate.bank_name) page4.drawText(sepaMandate.bank_name, { x: G4.COL_M1 - 25, y: Y_SEPA2, size: fontSize, font }); // Bank
        if (sepaMandate.bic)       page4.drawText(sepaMandate.bic,       { x: G4.COL_M2 + 5,  y: Y_SEPA2, size: fontSize, font }); // BIC

        // Ort/Datum Unterschrift Lastschriftmandat
        page4.drawText(new Date().toLocaleDateString("de-DE"), { x: G4.COL_L + 20, y: Y_SEPA2 - 35, size: fontSize, font });
      }

      // 16. Unterschriften Servicevereinbarung (ganz unten links)
      if (signature) {
        const Y_SIGN = 180; // Abstand vom unteren Rand
        page4.drawText(new Date(signature.timestamp).toLocaleDateString("de-DE"), { x: G4.COL_L + 20, y: Y_SIGN + 18, size: fontSize, font });
        if (authorizedPersons?.length) {
          page4.drawText(`${authorizedPersons[0].first_name ?? ""} ${authorizedPersons[0].last_name ?? ""}`.trim(), { x: G4.COL_L + 20, y: Y_SIGN, size: fontSize, font });
        }
        page4.drawText("(Elektronisch signiert)", { x: G4.COL_L + 20, y: Y_SIGN - 18, size: 8, font, color: rgb(0.5,0.5,0.5) });
      }
    }

    // Speichere PDF
    const pdfBytes = await pdfDoc.save();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `Vertrag_${customer.company_name.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.pdf`;

    // Speichere im Storage
    const { error: uploadError } = await supabase.storage
      .from("kyc-documents")
      .upload(`contracts/${customerId}/${fileName}`, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading contract:", uploadError);
      throw uploadError;
    }

    // Erstelle Document-Eintrag
    await supabase.from("documents").insert({
      customer_id: customerId,
      document_type: "other",
      file_name: fileName,
      file_path: `contracts/${customerId}/${fileName}`,
      file_size: pdfBytes.length,
      mime_type: "application/pdf",
    });

    console.log("Contract generated successfully:", fileName);

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        filePath: `contracts/${customerId}/${fileName}`,
        message: "Vertrag erfolgreich erstellt",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("Error generating contract:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
