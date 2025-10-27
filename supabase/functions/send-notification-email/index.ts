import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const NOTIFICATION_EMAIL = "j.schewe@codea.de";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "new_onboarding" | "signature";
  companyName: string;
  customerId: string;
  magicLink?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, companyName, customerId, magicLink }: NotificationRequest = await req.json();

    if (!BREVO_API_KEY) {
      console.error("BREVO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subject = "";
    let htmlContent = "";

    if (type === "new_onboarding") {
      subject = `Neues Onboarding: ${companyName}`;
      htmlContent = `
        <h2>Neues Onboarding eingegangen</h2>
        <p><strong>Unternehmen:</strong> ${companyName}</p>
        <p><strong>Kunden-ID:</strong> ${customerId}</p>
        ${magicLink ? `<p><strong>Magic Link:</strong> <a href="${magicLink}">${magicLink}</a></p>` : ""}
        <p>Das Onboarding wurde erstellt und der Kunde kann nun beginnen.</p>
      `;
    } else if (type === "signature") {
      subject = `Unterschrift erhalten: ${companyName}`;
      htmlContent = `
        <h2>Onboarding abgeschlossen</h2>
        <p><strong>Unternehmen:</strong> ${companyName}</p>
        <p><strong>Kunden-ID:</strong> ${customerId}</p>
        <p>Der Kunde hat das Onboarding abgeschlossen und den Vertrag unterschrieben.</p>
      `;
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "KYC System",
          email: "noreply@codea.de",
        },
        to: [
          {
            email: NOTIFICATION_EMAIL,
            name: "J. Schewe",
          },
        ],
        subject: subject,
        htmlContent: htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Brevo API error:", errorData);
      throw new Error(`Brevo API error: ${response.status}`);
    }

    const result = await response.json();
    console.log("Email sent successfully:", result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-notification-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
