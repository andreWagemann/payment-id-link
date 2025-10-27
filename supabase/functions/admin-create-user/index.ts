import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Nicht authentifiziert");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Benutzer nicht gefunden");
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      throw new Error("Zugriff verweigert: Admin-Rechte erforderlich");
    }

    // Get request body
    const { email, password }: CreateUserRequest = await req.json();

    if (!email || !password) {
      throw new Error("E-Mail und Passwort sind erforderlich");
    }

    // Create Supabase admin client
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

    // Create new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) throw createError;

    // Assign sales role to new user
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: "sales_user",
      });

    if (roleError) throw roleError;

    // Send email with credentials using Brevo
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (brevoApiKey) {
      const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "Payment AG", email: "noreply@payment-ag.de" },
          to: [{ email }],
          subject: "Ihr Vertriebskonto wurde erstellt",
          htmlContent: `
            <h1>Willkommen bei Payment AG</h1>
            <p>Ihr Vertriebskonto wurde erfolgreich erstellt.</p>
            <p><strong>Ihre Zugangsdaten:</strong></p>
            <p>E-Mail: ${email}<br>
            Passwort: ${password}</p>
            <p>Bitte ändern Sie Ihr Passwort nach der ersten Anmeldung.</p>
            <p><a href="${supabaseUrl.replace('supabase.co', 'lovableproject.com')}/auth">Zur Anmeldung</a></p>
          `,
        }),
      });

      if (!emailResponse.ok) {
        console.error("Fehler beim E-Mail-Versand:", await emailResponse.text());
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: newUser.user.id, email: newUser.user.email }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
