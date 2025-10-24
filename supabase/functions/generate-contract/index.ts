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

    console.log('Loaded customer data, loading template...');

    // Lade PDF-Template aus dem Storage
    const { data: templateData, error: downloadError } = await supabase.storage
      .from('kyc-documents')
      .download('templates/contract-template.pdf');

    if (downloadError) {
      console.error('Error downloading template:', downloadError);
      throw new Error('Template konnte nicht geladen werden: ' + JSON.stringify(downloadError));
    }

    if (!templateData) {
      throw new Error('Template ist leer');
    }

    console.log('Template loaded, parsing PDF...');
    const templateBytes = await templateData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);
    
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 9;

    // Seite 1 - Kontaktinformationen
    const page1 = pages[0];
    const { height } = page1.getSize();
    
    // Header - Kundennummer und Datum (Zeile oben)
    page1.drawText(customerId.substring(0, 13), { x: 37, y: height - 93, size: 8, font });
    page1.drawText(new Date().toLocaleDateString('de-DE'), { x: 470, y: height - 93, size: 8, font });
    
    // Tabelle Zeile 1 - Kundennummer, Leistungsbeginn, MCC, Vertragslaufzeit
    const tableY = height - 119;
    page1.drawText('00', { x: 50, y: tableY, size: 8, font }); // Kundennummer Platzhalter
    // Leistungsbeginn leer lassen
    // MCC leer lassen  
    // Vertragslaufzeit leer lassen
    
    // Firmenname und Rechtsform (direkt unter dem Text)
    page1.drawText(customer.company_name, { x: 37, y: height - 169, size: 10, font });
    page1.drawText(customer.legal_form.toUpperCase(), { x: 420, y: height - 169, size: 10, font });
    
    // 1. Kontaktinformationen Tabelle
    // Kundenname / Handelsname (leer, da schon oben)
    // rechtl. Firmierung (gleich wie Firmenname, leer lassen wenn identisch)
    // Rechtsform (schon gefüllt)
    
    // Firmenadresse - Straße
    page1.drawText(customer.street || '', { x: 37, y: height - 216, size: 9, font });
    
    // Telefon + PLZ + Stadt (in einer Zeile)
    const addressLineY = height - 228;
    // Telefon leer
    page1.drawText(customer.postal_code || '', { x: 90, y: addressLineY, size: 9, font });
    page1.drawText(customer.city || '', { x: 180, y: addressLineY, size: 9, font });
    
    // Zeile: Filiale, USt-IdNr., HR-Nummer, Registergericht
    const taxLineY = height - 240;
    // Filiale leer
    if (customer.vat_id) {
      page1.drawText(customer.vat_id, { x: 160, y: taxLineY, size: 8, font });
    }
    if (customer.commercial_register) {
      page1.drawText(customer.commercial_register, { x: 300, y: taxLineY, size: 8, font });
    }
    // Registergericht leer
    
    // Ländercode DE
    page1.drawText(customer.country || 'DE', { x: 37, y: height - 252, size: 9, font });
    
    // Firmenadresse Tabelle (leer, da schon oben)
    
    // Abweichende Standortadresse (leer lassen)
    
    // Ansprechpartner Tabelle
    if (authorizedPersons && authorizedPersons.length > 0) {
      const person1 = authorizedPersons[0];
      const contactY = height - 344;
      
      // Vorname(n), Name, E-Mail, Telefon Zentrale
      page1.drawText(person1.first_name, { x: 50, y: contactY, size: 8, font });
      page1.drawText(person1.last_name, { x: 140, y: contactY, size: 8, font });
      if (person1.email) {
        page1.drawText(person1.email, { x: 230, y: contactY, size: 8, font });
      }
      if (person1.phone) {
        page1.drawText(person1.phone, { x: 400, y: contactY, size: 8, font });
      }
    }
    
    // Zeile unter Ansprechpartner: Stadt, Geburtsdatum?, Ländercode
    const personInfoY = height - 357;
    if (authorizedPersons && authorizedPersons.length > 0) {
      const person1 = authorizedPersons[0];
      if (person1.private_city) {
        page1.drawText(person1.private_city, { x: 37, y: personInfoY, size: 8, font });
      }
      if (person1.date_of_birth) {
        page1.drawText(new Date(person1.date_of_birth).toLocaleDateString('de-DE'), { x: 180, y: personInfoY, size: 8, font });
      }
      if (person1.private_country) {
        page1.drawText(person1.private_country, { x: 450, y: personInfoY, size: 8, font });
      }
    }
    
    // Gläubiger-ID Nr. (leer)
    
    // Lieferadresse
    const deliveryY = height - 370;
    page1.drawText(customer.street || '', { x: 310, y: deliveryY, size: 8, font });
    const deliveryCityY = height - 382;
    page1.drawText(customer.postal_code || '', { x: 310, y: deliveryCityY, size: 8, font });
    page1.drawText(customer.city || '', { x: 380, y: deliveryCityY, size: 8, font });
    
    // 2. Rechtliche Vertreter
    // Checkbox: Kunde ist eine juristische Person (X setzen)
    page1.drawText('X', { x: 37, y: height - 417, size: 10, font });
    
    // Vertretungsberechtigung (Einzelvertretung oder gemeinsam)
    // Einzelvertretungsberechtigung checkbox
    page1.drawText('X', { x: 37, y: height - 442, size: 10, font });
    
    if (authorizedPersons && authorizedPersons.length > 0) {
      const person1 = authorizedPersons[0];
      
      // Vertreter 1 Tabelle: Anrede, Vorname(n), Nachname
      const rep1Y = height - 465;
      // Anrede leer
      page1.drawText(person1.first_name, { x: 100, y: rep1Y, size: 8, font });
      page1.drawText(person1.last_name, { x: 240, y: rep1Y, size: 8, font });
      
      // Geburtsort, Geburtsdatum, Nationalität (darunter)
      const rep1DetailsY = height - 477;
      if (person1.place_of_birth) {
        page1.drawText(person1.place_of_birth, { x: 80, y: rep1DetailsY, size: 8, font });
      }
      if (person1.date_of_birth) {
        page1.drawText(new Date(person1.date_of_birth).toLocaleDateString('de-DE'), { x: 210, y: rep1DetailsY, size: 8, font });
      }
      if (person1.nationality) {
        page1.drawText(person1.nationality, { x: 370, y: rep1DetailsY, size: 8, font });
      }
      
      // Privatadresse Tabelle
      const rep1AddressY = height - 503;
      if (person1.private_street) {
        page1.drawText(person1.private_street, { x: 120, y: rep1AddressY, size: 8, font });
      }
      if (person1.private_postal_code) {
        page1.drawText(person1.private_postal_code, { x: 280, y: rep1AddressY, size: 8, font });
      }
      if (person1.private_city) {
        page1.drawText(person1.private_city, { x: 340, y: rep1AddressY, size: 8, font });
      }
      if (person1.private_country) {
        page1.drawText(person1.private_country, { x: 480, y: rep1AddressY, size: 8, font });
      }
      
      // Ausweisdokument Tabelle
      const rep1IdY = height - 528;
      if (person1.id_document_number) {
        page1.drawText(person1.id_document_number, { x: 100, y: rep1IdY, size: 8, font });
      }
      if (person1.id_document_issue_date) {
        page1.drawText(new Date(person1.id_document_issue_date).toLocaleDateString('de-DE'), { x: 240, y: rep1IdY, size: 8, font });
      }
      if (person1.id_document_issuing_authority) {
        page1.drawText(person1.id_document_issuing_authority, { x: 380, y: rep1IdY, size: 8, font });
      }
      
      // 1. Persönliche Identifizierung
      // Checkboxen (Postident, Videoident, E-Mail, Telefonnummer) - leer lassen
      
      // E-Mail unter den Checkboxen
      if (person1.email) {
        page1.drawText(person1.email, { x: 140, y: height - 563, size: 8, font });
      }
      if (person1.phone) {
        page1.drawText(person1.phone, { x: 380, y: height - 563, size: 8, font });
      }
      
      // "Ich handle in eigenem Namen..." Checkbox
      page1.drawText('X', { x: 37, y: height - 595, size: 8, font });
      
      // Zweite Person falls vorhanden
      if (authorizedPersons.length > 1) {
        const person2 = authorizedPersons[1];
        
        const rep2Y = height - 658;
        page1.drawText(person2.first_name, { x: 100, y: rep2Y, size: 8, font });
        page1.drawText(person2.last_name, { x: 240, y: rep2Y, size: 8, font });
        
        const rep2DetailsY = height - 670;
        if (person2.place_of_birth) {
          page1.drawText(person2.place_of_birth, { x: 80, y: rep2DetailsY, size: 8, font });
        }
        if (person2.date_of_birth) {
          page1.drawText(new Date(person2.date_of_birth).toLocaleDateString('de-DE'), { x: 210, y: rep2DetailsY, size: 8, font });
        }
        if (person2.nationality) {
          page1.drawText(person2.nationality, { x: 370, y: rep2DetailsY, size: 8, font });
        }
        
        const rep2AddressY = height - 696;
        if (person2.private_street) {
          page1.drawText(person2.private_street, { x: 120, y: rep2AddressY, size: 8, font });
        }
        if (person2.private_postal_code) {
          page1.drawText(person2.private_postal_code, { x: 280, y: rep2AddressY, size: 8, font });
        }
        if (person2.private_city) {
          page1.drawText(person2.private_city, { x: 340, y: rep2AddressY, size: 8, font });
        }
        
        const rep2IdY = height - 721;
        if (person2.id_document_number) {
          page1.drawText(person2.id_document_number, { x: 100, y: rep2IdY, size: 8, font });
        }
        
        if (person2.email) {
          page1.drawText(person2.email, { x: 140, y: height - 756, size: 8, font });
        }
        if (person2.phone) {
          page1.drawText(person2.phone, { x: 380, y: height - 756, size: 8, font });
        }
      }
    }

    // Seite 2 - Wirtschaftlich Berechtigte
    if (pages.length > 1 && beneficialOwners && beneficialOwners.length > 0) {
      const page2 = pages[1];
      const { height: h2 } = page2.getSize();
      
      let yOffset = 0;
      beneficialOwners.forEach((owner, index) => {
        if (index < 3) {
          const baseY = h2 - 285;
          yOffset = index * 20;
          
          page2.drawText(`${owner.first_name} ${owner.last_name}`, { 
            x: 140, 
            y: baseY - yOffset, 
            size: fontSize, 
            font 
          });
          
          if (owner.date_of_birth) {
            page2.drawText(new Date(owner.date_of_birth).toLocaleDateString('de-DE'), { 
              x: 280, 
              y: baseY - yOffset, 
              size: fontSize, 
              font 
            });
          }
          
          if (owner.nationality) {
            page2.drawText(owner.nationality, { 
              x: 380, 
              y: baseY - yOffset, 
              size: fontSize, 
              font 
            });
          }
          
          page2.drawText(`${owner.ownership_percentage}%`, { 
            x: 480, 
            y: baseY - yOffset, 
            size: fontSize, 
            font 
          });
        }
      });
    }

    // Seite 3 - Produkte
    if (pages.length > 2 && products && products.length > 0) {
      const page3 = pages[2];
      const { height: h3 } = page3.getSize();
      
      let yOffset = 0;
      products.forEach((product, index) => {
        if (index < 3) {
          const baseY = h3 - 220;
          yOffset = index * 25;
          
          page3.drawText(product.product_type, { 
            x: 95, 
            y: baseY - yOffset, 
            size: fontSize, 
            font 
          });
          
          page3.drawText(product.quantity.toString(), { 
            x: 200, 
            y: baseY - yOffset, 
            size: fontSize, 
            font 
          });
          
          if (product.monthly_rent) {
            page3.drawText(product.monthly_rent.toString(), { 
              x: 280, 
              y: baseY - yOffset, 
              size: fontSize, 
              font 
            });
          }
        }
      });
    }

    // Seite 4 - SEPA-Mandat und Unterschrift
    if (pages.length > 3) {
      const page4 = pages[3];
      const { height: h4 } = page4.getSize();
      
      if (sepaMandate) {
        // Kontoinhaber
        page4.drawText(sepaMandate.account_holder, { x: 125, y: h4 - 195, size: fontSize, font });
        
        // IBAN
        page4.drawText(sepaMandate.iban, { x: 310, y: h4 - 195, size: fontSize, font });
        
        // Bank
        if (sepaMandate.bank_name) {
          page4.drawText(sepaMandate.bank_name, { x: 125, y: h4 - 210, size: fontSize, font });
        }
        
        // BIC
        if (sepaMandate.bic) {
          page4.drawText(sepaMandate.bic, { x: 310, y: h4 - 210, size: fontSize, font });
        }
        
        // Datum + Unterschrift Lastschriftmandat
        page4.drawText(new Date().toLocaleDateString('de-DE'), { x: 95, y: h4 - 245, size: fontSize, font });
      }

      // Unterschrift Servicevereinbarung
      if (signature) {
        page4.drawText(new Date(signature.timestamp).toLocaleDateString('de-DE'), { x: 95, y: h4 - 540, size: fontSize, font });
        
        if (authorizedPersons && authorizedPersons.length > 0) {
          page4.drawText(`${authorizedPersons[0].first_name} ${authorizedPersons[0].last_name}`, { 
            x: 95, 
            y: h4 - 555, 
            size: fontSize, 
            font 
          });
        }
        
        // Hinweis auf elektronische Unterschrift
        page4.drawText('(Elektronisch signiert)', { 
          x: 95, 
          y: h4 - 575, 
          size: 8, 
          font, 
          color: rgb(0.5, 0.5, 0.5) 
        });
      }
    }

    // Speichere PDF
    const pdfBytes = await pdfDoc.save();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `Vertrag_${customer.company_name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
    
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

    // Erstelle Document-Eintrag
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
