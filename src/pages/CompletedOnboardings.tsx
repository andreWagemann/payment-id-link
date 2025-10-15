import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye } from "lucide-react";
import { toast } from "sonner";

type CompletedOnboarding = {
  id: string;
  company_name: string;
  legal_form: string;
  completed_at: string;
  signature?: {
    id: string;
    signature_data: string;
    timestamp: string;
    terms_accepted: boolean;
    privacy_accepted: boolean;
  };
};

const CompletedOnboardings = () => {
  const navigate = useNavigate();
  const [onboardings, setOnboardings] = useState<CompletedOnboarding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadCompletedOnboardings();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadCompletedOnboardings = async () => {
    try {
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("id, company_name, legal_form, completed_at")
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });

      if (customersError) throw customersError;

      if (!customers || customers.length === 0) {
        setOnboardings([]);
        setLoading(false);
        return;
      }

      // Load signatures for each customer
      const onboardingsWithSignatures = await Promise.all(
        customers.map(async (customer) => {
          const { data: signature } = await supabase
            .from("signatures")
            .select("id, signature_data, timestamp, terms_accepted, privacy_accepted")
            .eq("customer_id", customer.id)
            .order("timestamp", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...customer,
            signature: signature || undefined,
          };
        })
      );

      setOnboardings(onboardingsWithSignatures);
    } catch (error: any) {
      toast.error("Fehler beim Laden der Onboardings");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const downloadSignature = (companyName: string, signatureData: string) => {
    const link = document.createElement("a");
    link.href = signatureData;
    link.download = `Unterschrift_${companyName}_${new Date().toISOString().split('T')[0]}.png`;
    link.click();
    toast.success("Download gestartet");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Abgeschlossene Onboardings</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Unterschriebene Onboardings</h2>
          <p className="text-muted-foreground mt-1">
            Übersicht aller abgeschlossenen Kundenonboardings mit Unterschriften
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">Lädt...</div>
        ) : onboardings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Noch keine abgeschlossenen Onboardings vorhanden
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {onboardings.map((onboarding) => (
              <Card key={onboarding.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{onboarding.company_name}</CardTitle>
                      <CardDescription className="mt-1">
                        {onboarding.legal_form.toUpperCase()} · Abgeschlossen am{" "}
                        {new Date(onboarding.completed_at).toLocaleDateString("de-DE")} um{" "}
                        {new Date(onboarding.completed_at).toLocaleTimeString("de-DE")}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">Abgeschlossen</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {onboarding.signature ? (
                    <>
                      <div>
                        <h3 className="font-semibold mb-2">Unterschrift</h3>
                        <div className="border rounded-lg p-4 bg-white">
                          <img
                            src={onboarding.signature.signature_data}
                            alt={`Unterschrift ${onboarding.company_name}`}
                            className="max-w-full h-auto"
                            style={{ maxHeight: "200px" }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={onboarding.signature.terms_accepted ? "outline" : "secondary"}>
                          {onboarding.signature.terms_accepted ? "✓" : "✗"} AGB akzeptiert
                        </Badge>
                        <Badge variant={onboarding.signature.privacy_accepted ? "outline" : "secondary"}>
                          {onboarding.signature.privacy_accepted ? "✓" : "✗"} Datenschutz akzeptiert
                        </Badge>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => navigate(`/dashboard/customer/${onboarding.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Details ansehen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            downloadSignature(
                              onboarding.company_name,
                              onboarding.signature!.signature_data
                            )
                          }
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Unterschrift herunterladen
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      Keine Unterschrift vorhanden
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CompletedOnboardings;
