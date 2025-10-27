import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    console.log("Cleaning up old contracts for customer:", customerId);

    // Get all contracts for this customer, ordered by date (newest first)
    const { data: contracts, error: fetchError } = await supabase
      .from("documents")
      .select("id, file_path, file_name, uploaded_at")
      .eq("customer_id", customerId)
      .eq("document_type", "other")
      .ilike("file_name", "Vertrag_%")
      .order("uploaded_at", { ascending: false });

    if (fetchError) throw fetchError;

    if (!contracts || contracts.length <= 1) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No old contracts to delete",
          deleted: 0
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Keep the first one (newest), delete the rest
    const contractsToDelete = contracts.slice(1);
    console.log(`Found ${contractsToDelete.length} old contracts to delete`);

    let deletedCount = 0;
    
    for (const contract of contractsToDelete) {
      try {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from("kyc-documents")
          .remove([contract.file_path]);

        if (storageError) {
          console.error(`Error deleting file ${contract.file_path}:`, storageError);
        } else {
          console.log(`Deleted file: ${contract.file_path}`);
        }

        // Delete from database
        const { error: dbError } = await supabase
          .from("documents")
          .delete()
          .eq("id", contract.id);

        if (dbError) {
          console.error(`Error deleting document record ${contract.id}:`, dbError);
        } else {
          console.log(`Deleted document record: ${contract.id}`);
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error processing contract ${contract.file_name}:`, error);
      }
    }

    console.log(`Successfully deleted ${deletedCount} old contracts`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${deletedCount} old contracts`,
        deleted: deletedCount,
        kept: contracts[0].file_name
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error cleaning up contracts:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

