import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

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

    // Erstelle neues PDF-Dokument von Grund auf
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 Format
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 10;
    const titleSize = 16;
    const headingSize = 12;

    let yPos = 800;

    // Titel
    page.drawText('Servicevereinbarung Terminal', {
      x: 50,
      y: yPos,
      size: titleSize,
      font: fontBold,
    });
    page.drawText('Beyond inkl. Kartenakzeptanz stationärer Handel by RS2', {
      x: 50,
      y: yPos - 20,
      size: 12,
      font,
    });

    yPos -= 60;

    // Kundendaten
    page.drawText('1. Kontaktinformationen', {
      x: 50,
      y: yPos,
      size: headingSize,
      font: fontBold,
    });
    yPos -= 25;

    page.drawText(`Firmenname: ${customer.company_name}`, { x: 50, y: yPos, size: fontSize, font });
    yPos -= 15;
    page.drawText(`Rechtsform: ${customer.legal_form.toUpperCase()}`, { x: 50, y: yPos, size: fontSize, font });
    yPos -= 15;
    
    if (customer.vat_id) {
      page.drawText(`USt-IdNr.: ${customer.vat_id}`, { x: 50, y: yPos, size: fontSize, font });
      yPos -= 15;
    }
    
    if (customer.commercial_register) {
      page.drawText(`Handelsregister: ${customer.commercial_register}`, { x: 50, y: yPos, size: fontSize, font });
      yPos -= 15;
    }

    page.drawText(`Adresse: ${customer.street || ''}`, { x: 50, y: yPos, size: fontSize, font });
    yPos -= 15;
    page.drawText(`${customer.postal_code || ''} ${customer.city || ''}, ${customer.country || 'DE'}`, { 
      x: 50, y: yPos, size: fontSize, font 
    });
    yPos -= 30;

    // Vertretungsberechtigte Personen
    if (authorizedPersons && authorizedPersons.length > 0) {
      page.drawText('2. Vertretungsberechtigte Personen', {
        x: 50,
        y: yPos,
        size: headingSize,
        font: fontBold,
      });
      yPos -= 25;

      authorizedPersons.forEach((person, index) => {
        if (yPos < 100) {
          // Neue Seite wenn nicht genug Platz
          const newPage = pdfDoc.addPage([595, 842]);
          yPos = 800;
        }

        page.drawText(`Person ${index + 1}: ${person.first_name} ${person.last_name}`, {
          x: 50, y: yPos, size: fontSize, font: fontBold
        });
        yPos -= 15;
        
        if (person.date_of_birth) {
          page.drawText(`Geburtsdatum: ${new Date(person.date_of_birth).toLocaleDateString('de-DE')}`, {
            x: 70, y: yPos, size: fontSize, font
          });
          yPos -= 15;
        }
        
        if (person.place_of_birth) {
          page.drawText(`Geburtsort: ${person.place_of_birth}`, { x: 70, y: yPos, size: fontSize, font });
          yPos -= 15;
        }
        
        if (person.nationality) {
          page.drawText(`Nationalität: ${person.nationality}`, { x: 70, y: yPos, size: fontSize, font });
          yPos -= 15;
        }
        
        if (person.email) {
          page.drawText(`E-Mail: ${person.email}`, { x: 70, y: yPos, size: fontSize, font });
          yPos -= 15;
        }

        page.drawText(`Privatadresse: ${person.private_street || ''}`, { x: 70, y: yPos, size: fontSize, font });
        yPos -= 15;
        page.drawText(`${person.private_postal_code || ''} ${person.private_city || ''}, ${person.private_country || ''}`, {
          x: 70, y: yPos, size: fontSize, font
        });
        yPos -= 25;
      });
    }

    // Wirtschaftlich Berechtigte
    if (beneficialOwners && beneficialOwners.length > 0) {
      if (yPos < 150) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPos = 800;
      }

      page.drawText('3. Wirtschaftlich Berechtigte', {
        x: 50,
        y: yPos,
        size: headingSize,
        font: fontBold,
      });
      yPos -= 25;

      beneficialOwners.forEach((owner, index) => {
        page.drawText(
          `${owner.first_name} ${owner.last_name} - ${owner.ownership_percentage}% Beteiligung`,
          { x: 50, y: yPos, size: fontSize, font }
        );
        yPos -= 15;
      });
      yPos -= 20;
    }

    // SEPA-Mandat
    if (sepaMandate) {
      if (yPos < 150) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPos = 800;
      }

      page.drawText('4. SEPA-Lastschriftmandat', {
        x: 50,
        y: yPos,
        size: headingSize,
        font: fontBold,
      });
      yPos -= 25;

      page.drawText(`Kontoinhaber: ${sepaMandate.account_holder}`, { x: 50, y: yPos, size: fontSize, font });
      yPos -= 15;
      page.drawText(`IBAN: ${sepaMandate.iban}`, { x: 50, y: yPos, size: fontSize, font });
      yPos -= 15;
      
      if (sepaMandate.bic) {
        page.drawText(`BIC: ${sepaMandate.bic}`, { x: 50, y: yPos, size: fontSize, font });
        yPos -= 15;
      }
      
      if (sepaMandate.bank_name) {
        page.drawText(`Bank: ${sepaMandate.bank_name}`, { x: 50, y: yPos, size: fontSize, font });
        yPos -= 15;
      }
      
      page.drawText(`Mandatsreferenz: ${sepaMandate.mandate_reference}`, { x: 50, y: yPos, size: fontSize, font });
      yPos -= 15;
      page.drawText(`Mandatsdatum: ${new Date(sepaMandate.mandate_date).toLocaleDateString('de-DE')}`, { 
        x: 50, y: yPos, size: fontSize, font 
      });
      yPos -= 15;
      
      if (sepaMandate.accepted) {
        page.drawText(`Akzeptiert am: ${new Date(sepaMandate.accepted_at!).toLocaleDateString('de-DE')}`, {
          x: 50, y: yPos, size: fontSize, font
        });
        yPos -= 15;
      }
      yPos -= 20;
    }

    // Produkte
    if (products && products.length > 0) {
      if (yPos < 150) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPos = 800;
      }

      page.drawText('5. Produkte und Konditionen', {
        x: 50,
        y: yPos,
        size: headingSize,
        font: fontBold,
      });
      yPos -= 25;

      products.forEach((product) => {
        page.drawText(
          `${product.product_type} - Anzahl: ${product.quantity}`,
          { x: 50, y: yPos, size: fontSize, font }
        );
        yPos -= 15;
        
        if (product.monthly_rent) {
          page.drawText(`Monatliche Miete: ${product.monthly_rent} €`, { x: 70, y: yPos, size: fontSize, font });
          yPos -= 15;
        }
        
        if (product.setup_fee) {
          page.drawText(`Einrichtungsgebühr: ${product.setup_fee} €`, { x: 70, y: yPos, size: fontSize, font });
          yPos -= 15;
        }
        yPos -= 10;
      });
      yPos -= 20;
    }

    // Unterschrift
    if (signature) {
      if (yPos < 100) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPos = 800;
      }

      page.drawText('6. Unterschrift', {
        x: 50,
        y: yPos,
        size: headingSize,
        font: fontBold,
      });
      yPos -= 25;

      page.drawText(`Elektronisch signiert am: ${new Date(signature.timestamp).toLocaleDateString('de-DE')}`, {
        x: 50, y: yPos, size: fontSize, font
      });
      yPos -= 15;
      
      page.drawText(`AGB akzeptiert: ${signature.terms_accepted ? 'Ja' : 'Nein'}`, {
        x: 50, y: yPos, size: fontSize, font
      });
      yPos -= 15;
      
      page.drawText(`Datenschutz akzeptiert: ${signature.privacy_accepted ? 'Ja' : 'Nein'}`, {
        x: 50, y: yPos, size: fontSize, font
      });
    }

    // Footer
    const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    lastPage.drawText(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, {
      x: 50,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

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
