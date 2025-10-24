import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { customerId } = await req.json();
    console.log('Generating contract for customer:', customerId);

    // Lade Kundendaten
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError) {
      console.error('Error loading customer:', customerError);
      throw new Error('Kunde nicht gefunden');
    }

    // Lade vertretungsberechtigte Personen
    const { data: authorizedPersons } = await supabase
      .from('authorized_persons')
      .select('*')
      .eq('customer_id', customerId);

    // Lade wirtschaftlich Berechtigte
    const { data: beneficialOwners } = await supabase
      .from('beneficial_owners')
      .select('*')
      .eq('customer_id', customerId);

    // Lade SEPA-Mandat
    const { data: sepaMandate } = await supabase
      .from('sepa_mandates')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    // Lade Unterschrift
    const { data: signature } = await supabase
      .from('signatures')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    // Lade Produkte
    const { data: products } = await supabase
      .from('customer_products')
      .select('*')
      .eq('customer_id', customerId);

    // Lade Transaktionsgebühren
    const { data: fees } = await supabase
      .from('customer_transaction_fees')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    console.log('Loaded customer data, creating PDF...');

    // Lade PDF-Vorlage
    const templateResponse = await fetch(`${supabaseUrl}/storage/v1/object/public/kyc-documents/contract-template.pdf`);
    if (!templateResponse.ok) {
      // Falls nicht im Storage, lade von public folder (für Entwicklung)
      const publicUrl = `${supabaseUrl.replace('.supabase.co', '')}/contract-template.pdf`;
      console.log('Template not in storage, trying public URL');
    }
    
    const templateBytes = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;

    // Seite 1 - Kontaktinformationen
    const page1 = pages[0];
    
    // Kundennummer, Leistungsbeginn, etc.
    page1.drawText(customerId.substring(0, 8), { x: 100, y: 750, size: fontSize, font });
    page1.drawText(new Date().toLocaleDateString('de-DE'), { x: 200, y: 750, size: fontSize, font });
    
    // Kundenname / Handelsname
    page1.drawText(customer.company_name, { x: 100, y: 680, size: fontSize, font });
    
    // Rechtsform
    page1.drawText(customer.legal_form.toUpperCase(), { x: 400, y: 680, size: fontSize, font });
    
    // USt-IdNr.
    if (customer.vat_id) {
      page1.drawText(customer.vat_id, { x: 200, y: 665, size: fontSize, font });
    }
    
    // HR-Nummer
    if (customer.commercial_register) {
      page1.drawText(customer.commercial_register, { x: 350, y: 665, size: fontSize, font });
    }
    
    // Firmenadresse
    page1.drawText(customer.street || '', { x: 100, y: 640, size: fontSize, font });
    page1.drawText(customer.postal_code || '', { x: 100, y: 625, size: fontSize, font });
    page1.drawText(customer.city || '', { x: 180, y: 625, size: fontSize, font });
    page1.drawText(customer.country || 'DE', { x: 100, y: 610, size: fontSize, font });

    // Vertretungsberechtigte Personen
    if (authorizedPersons && authorizedPersons.length > 0) {
      const person1 = authorizedPersons[0];
      let yPos = 520;
      
      page1.drawText(`${person1.first_name} ${person1.last_name}`, { x: 150, y: yPos, size: fontSize, font });
      page1.drawText(person1.place_of_birth || '', { x: 100, y: yPos - 15, size: fontSize, font });
      page1.drawText(person1.date_of_birth ? new Date(person1.date_of_birth).toLocaleDateString('de-DE') : '', { x: 200, y: yPos - 15, size: fontSize, font });
      page1.drawText(person1.nationality || '', { x: 350, y: yPos - 15, size: fontSize, font });
      
      // Privatadresse
      page1.drawText(person1.private_street || '', { x: 100, y: yPos - 45, size: fontSize, font });
      page1.drawText(person1.private_postal_code || '', { x: 250, y: yPos - 45, size: fontSize, font });
      page1.drawText(person1.private_city || '', { x: 320, y: yPos - 45, size: fontSize, font });
      
      // Ausweisdaten
      page1.drawText(person1.id_document_number || '', { x: 200, y: yPos - 60, size: fontSize, font });
      page1.drawText(person1.id_document_issue_date ? new Date(person1.id_document_issue_date).toLocaleDateString('de-DE') : '', { x: 300, y: yPos - 60, size: fontSize, font });
      page1.drawText(person1.id_document_issuing_authority || '', { x: 400, y: yPos - 60, size: fontSize, font });
      
      page1.drawText(person1.email || '', { x: 100, y: yPos - 85, size: fontSize, font });
      
      // Zweite Person falls vorhanden
      if (authorizedPersons.length > 1) {
        const person2 = authorizedPersons[1];
        yPos = 350;
        
        page1.drawText(`${person2.first_name} ${person2.last_name}`, { x: 150, y: yPos, size: fontSize, font });
        page1.drawText(person2.place_of_birth || '', { x: 100, y: yPos - 15, size: fontSize, font });
        page1.drawText(person2.date_of_birth ? new Date(person2.date_of_birth).toLocaleDateString('de-DE') : '', { x: 200, y: yPos - 15, size: fontSize, font });
        page1.drawText(person2.nationality || '', { x: 350, y: yPos - 15, size: fontSize, font });
        page1.drawText(person2.private_street || '', { x: 100, y: yPos - 45, size: fontSize, font });
        page1.drawText(person2.email || '', { x: 100, y: yPos - 85, size: fontSize, font });
      }
    }

    // Seite 2 - Wirtschaftlich Berechtigte
    const page2 = pages[1];
    if (beneficialOwners && beneficialOwners.length > 0) {
      let yPos = 600;
      beneficialOwners.forEach((owner, index) => {
        if (index < 3) {
          page2.drawText(`${owner.first_name} ${owner.last_name}`, { x: 150, y: yPos - (index * 30), size: fontSize, font });
          page2.drawText(owner.date_of_birth ? new Date(owner.date_of_birth).toLocaleDateString('de-DE') : '', { x: 280, y: yPos - (index * 30), size: fontSize, font });
          page2.drawText(owner.nationality || '', { x: 380, y: yPos - (index * 30), size: fontSize, font });
          page2.drawText(`${owner.ownership_percentage}%`, { x: 480, y: yPos - (index * 30), size: fontSize, font });
        }
      });
    }

    // Seite 3 - Produkte und Konditionen
    const page3 = pages[2];
    if (products && products.length > 0) {
      let yPos = 650;
      products.forEach((product, index) => {
        if (index < 5) {
          page3.drawText(product.product_type, { x: 100, y: yPos - (index * 25), size: fontSize, font });
          page3.drawText(product.quantity.toString(), { x: 200, y: yPos - (index * 25), size: fontSize, font });
          if (product.monthly_rent) {
            page3.drawText(product.monthly_rent.toString(), { x: 270, y: yPos - (index * 25), size: fontSize, font });
          }
          if (product.setup_fee) {
            page3.drawText(product.setup_fee.toString(), { x: 360, y: yPos - (index * 25), size: fontSize, font });
          }
        }
      });
    }

    // Seite 4 - SEPA-Mandat und Unterschrift
    const page4 = pages[3];
    if (sepaMandate) {
      page4.drawText(sepaMandate.account_holder, { x: 100, y: 650, size: fontSize, font });
      page4.drawText(sepaMandate.iban, { x: 300, y: 650, size: fontSize, font });
      page4.drawText(sepaMandate.bank_name || '', { x: 100, y: 635, size: fontSize, font });
      page4.drawText(sepaMandate.bic || '', { x: 300, y: 635, size: fontSize, font });
      
      // Datum Lastschriftmandat
      page4.drawText(new Date().toLocaleDateString('de-DE'), { x: 100, y: 580, size: fontSize, font });
      page4.drawText(sepaMandate.mandate_reference, { x: 300, y: 520, size: fontSize, font });
    }

    // Unterschrift
    if (signature) {
      page4.drawText(new Date(signature.timestamp).toLocaleDateString('de-DE'), { x: 100, y: 310, size: fontSize, font });
      if (authorizedPersons && authorizedPersons.length > 0) {
        page4.drawText(`${authorizedPersons[0].first_name} ${authorizedPersons[0].last_name}`, { x: 100, y: 295, size: fontSize, font });
      }
      
      // Hinweis auf digitale Unterschrift
      page4.drawText('Elektronisch signiert', { x: 100, y: 270, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    }

    // Speichere PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `Vertrag_${customer.company_name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Speichere im Storage
    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(`contracts/${customerId}/${fileName}`, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading contract:', uploadError);
      throw uploadError;
    }

    // Erstelle auch einen Document-Eintrag
    await supabase.from('documents').insert({
      customer_id: customerId,
      document_type: 'other',
      file_name: fileName,
      file_path: `contracts/${customerId}/${fileName}`,
      file_size: pdfBytes.length,
      mime_type: 'application/pdf',
    });

    console.log('Contract generated successfully:', fileName);

    return new Response(
      JSON.stringify({ 
        success: true, 
        fileName,
        filePath: `contracts/${customerId}/${fileName}`,
        message: 'Vertrag erfolgreich erstellt' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error generating contract:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
