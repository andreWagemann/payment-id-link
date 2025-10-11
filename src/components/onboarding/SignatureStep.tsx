import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Eraser } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

type SignatureStepProps = {
  customerId: string;
  onComplete: () => void;
};

const SignatureStep = ({ customerId, onComplete }: SignatureStepProps) => {
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleSubmit = async () => {
    if (!termsAccepted || !privacyAccepted) {
      toast.error("Bitte akzeptieren Sie die AGB und Datenschutzerklärung");
      return;
    }

    if (sigCanvas.current?.isEmpty()) {
      toast.error("Bitte zeichnen Sie Ihre Unterschrift");
      return;
    }

    setLoading(true);

    try {
      const signatureData = sigCanvas.current?.toDataURL();
      
      // Audit-Trail Daten sammeln
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipResponse.json();
      const userAgent = navigator.userAgent;

      // Hash des Dokuments (vereinfacht)
      const documentHash = btoa(`${customerId}-${Date.now()}`);

      const { error: sigError } = await supabase.from("signatures").insert([
        {
          customer_id: customerId,
          signature_data: signatureData,
          ip_address: ipData.ip,
          user_agent: userAgent,
          document_hash: documentHash,
          terms_accepted: termsAccepted,
          privacy_accepted: privacyAccepted,
        },
      ]);

      if (sigError) throw sigError;

      const { error: updateError } = await supabase
        .from("customers")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", customerId);

      if (updateError) throw updateError;

      toast.success("Onboarding erfolgreich abgeschlossen!");
      onComplete();
    } catch (error: any) {
      toast.error("Fehler beim Abschließen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unterschrift & Bestätigung</CardTitle>
        <CardDescription>
          Bitte lesen und akzeptieren Sie die Bedingungen und zeichnen Sie Ihre Unterschrift
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
            />
            <div className="flex-1">
              <Label htmlFor="terms" className="cursor-pointer">
                Ich akzeptiere die{" "}
                <a href="#" className="text-primary hover:underline">
                  Allgemeinen Geschäftsbedingungen
                </a>
              </Label>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <Checkbox
              id="privacy"
              checked={privacyAccepted}
              onCheckedChange={(checked) => setPrivacyAccepted(checked as boolean)}
            />
            <div className="flex-1">
              <Label htmlFor="privacy" className="cursor-pointer">
                Ich habe die{" "}
                <a href="#" className="text-primary hover:underline">
                  Datenschutzerklärung
                </a>{" "}
                zur Kenntnis genommen
              </Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Ihre Unterschrift</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSignature}
            >
              <Eraser className="h-4 w-4 mr-2" />
              Löschen
            </Button>
          </div>
          <div className="border-2 border-border rounded-lg overflow-hidden bg-background">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                className: "w-full h-48 touch-none",
              }}
              backgroundColor="white"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Zeichnen Sie Ihre Unterschrift mit der Maus oder dem Finger
          </p>
        </div>

        <div className="p-4 bg-muted rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-2">Audit-Trail Information:</p>
          <ul className="space-y-1">
            <li>• Zeitstempel der Unterschrift wird gespeichert</li>
            <li>• IP-Adresse und Browser-Information werden erfasst</li>
            <li>• Dokument-Hash wird für Nachweiszwecke generiert</li>
          </ul>
        </div>

        <Button
          onClick={handleSubmit}
          className="w-full"
          disabled={loading || !termsAccepted || !privacyAccepted}
        >
          {loading ? "Wird abgeschlossen..." : "Onboarding abschließen"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SignatureStep;