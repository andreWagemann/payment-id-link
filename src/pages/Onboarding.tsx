import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, CheckCircle2 } from "lucide-react";
import CompanyStep from "@/components/onboarding/CompanyStep";
import AuthorizedPersonsStep from "@/components/onboarding/AuthorizedPersonsStep";
import BeneficialOwnersStep from "@/components/onboarding/BeneficialOwnersStep";
import DocumentsStep from "@/components/onboarding/DocumentsStep";
import SignatureStep from "@/components/onboarding/SignatureStep";
import { Progress } from "@/components/ui/progress";

type Customer = {
  id: string;
  company_name: string;
  legal_form: string;
  status: string;
};

const Onboarding = () => {
  const { token } = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    loadCustomer();
  }, [token]);

  const loadCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("magic_link_token", token)
        .single();

      if (error) throw error;

      if (!data) {
        toast.error("Ungültiger oder abgelaufener Link");
        return;
      }

      if (data.status === "completed") {
        setCurrentStep(6);
      }

      setCustomer(data);
    } catch (error) {
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  };

  const handleStepBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Lädt...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">Ungültiger oder abgelaufener Link</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const steps = [
    { num: 1, label: "Unternehmen" },
    { num: 2, label: "Vertretungsber." },
    { num: 3, label: "Wirtsch. Ber." },
    { num: 4, label: "Dokumente" },
    { num: 5, label: "Unterschrift" },
  ];

  const progress = ((currentStep - 1) / 5) * 100;

  if (currentStep === 6) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-success/10 p-4 rounded-full">
                <CheckCircle2 className="h-16 w-16 text-success" />
              </div>
            </div>
            <CardTitle className="text-3xl">Onboarding abgeschlossen</CardTitle>
            <CardDescription className="text-base mt-2">
              Vielen Dank! Ihre Angaben wurden erfolgreich übermittelt. Unser Team wird sich in Kürze
              bei Ihnen melden.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Payment AG – KYC Onboarding</h1>
              <p className="text-sm text-muted-foreground">{customer.company_name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step) => (
              <div
                key={step.num}
                className={`flex items-center ${
                  step.num < steps.length ? "flex-1" : ""
                }`}
              >
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    currentStep >= step.num
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {step.num}
                </div>
                {step.num < steps.length && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-colors ${
                      currentStep > step.num ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {currentStep === 1 && (
          <CompanyStep customer={customer} onComplete={handleStepComplete} />
        )}
        {currentStep === 2 && (
          <AuthorizedPersonsStep 
            customerId={customer.id} 
            onComplete={handleStepComplete}
            onBack={handleStepBack}
          />
        )}
        {currentStep === 3 && (
          <BeneficialOwnersStep 
            customerId={customer.id} 
            onComplete={handleStepComplete}
            onBack={handleStepBack}
          />
        )}
        {currentStep === 4 && (
          <DocumentsStep 
            customerId={customer.id} 
            legalForm={customer.legal_form} 
            onComplete={handleStepComplete}
            onBack={handleStepBack}
          />
        )}
        {currentStep === 5 && (
          <SignatureStep 
            customerId={customer.id} 
            onComplete={handleStepComplete}
            onBack={handleStepBack}
          />
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          Ihre Daten werden verschlüsselt übertragen und gemäß DSGVO verarbeitet.{" "}
          <a href="#" className="underline hover:text-foreground">
            Datenschutzhinweise
          </a>
        </p>
      </main>
    </div>
  );
};

export default Onboarding;