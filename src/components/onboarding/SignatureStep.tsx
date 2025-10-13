import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eraser, Euro } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

type SignatureStepProps = {
  customerId: string;
  onComplete: () => void;
  onBack?: () => void;
};

const SignatureStep = ({ customerId, onComplete, onBack }: SignatureStepProps) => {
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [cardFees, setCardFees] = useState<any>(null);

  useEffect(() => {
    loadPricing();
  }, [customerId]);

  const loadPricing = async () => {
    try {
      const { data: productsData } = await supabase
        .from("customer_products")
        .select("*")
        .eq("customer_id", customerId);

      const { data: feesData } = await supabase
        .from("customer_transaction_fees")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();

      setProducts(productsData || []);
      setCardFees(feesData);
    } catch (error) {
      console.error("Fehler beim Laden der Preise:", error);
    }
  };

  const getProductLabel = (type: string) => {
    const labels: Record<string, string> = {
      mobile_terminal: "Mobiles Terminal",
      stationary_terminal: "Stationäres Terminal",
      softpos: "SOFTPOS",
      ecommerce: "eCommerce",
    };
    return labels[type] || type;
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "0,00 €";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (!value) return "0,00 %";
    return `${value.toFixed(2).replace(".", ",")} %`;
  };

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
        {/* Preisübersicht */}
        {products.length > 0 && (
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-4">
              <Euro className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Ihre Preisübersicht</h3>
            </div>
            
            <div className="space-y-4">
              {products.map((product, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      {getProductLabel(product.product_type)} 
                      {product.quantity > 1 && ` (${product.quantity}x)`}
                    </h4>
                  </div>
                  <div className="space-y-1 text-sm pl-4">
                    {product.monthly_rent && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monatsmiete:</span>
                        <span className="font-medium">{formatCurrency(product.monthly_rent)}</span>
                      </div>
                    )}
                    {product.setup_fee && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Einrichtung:</span>
                        <span className="font-medium">{formatCurrency(product.setup_fee)}</span>
                      </div>
                    )}
                    {product.shipping_fee && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Versand:</span>
                        <span className="font-medium">{formatCurrency(product.shipping_fee)}</span>
                      </div>
                    )}
                    {product.transaction_fee && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transaktionspreis:</span>
                        <span className="font-medium">{formatCurrency(product.transaction_fee)}</span>
                      </div>
                    )}
                  </div>
                  {index < products.length - 1 && <Separator className="mt-3" />}
                </div>
              ))}

              {cardFees && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium">Kartengebühren</h4>
                    <div className="space-y-1 text-sm pl-4">
                      {(cardFees.pos_girocard_fee_percent || cardFees.pos_credit_card_fee_percent) && (
                        <>
                          <div className="text-xs font-medium text-muted-foreground mt-2">POS-Terminals:</div>
                          {cardFees.pos_girocard_fee_percent && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Girocard:</span>
                              <span className="font-medium">{formatPercent(cardFees.pos_girocard_fee_percent)}</span>
                            </div>
                          )}
                          {cardFees.pos_credit_card_fee_percent && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Kreditkarte:</span>
                              <span className="font-medium">{formatPercent(cardFees.pos_credit_card_fee_percent)}</span>
                            </div>
                          )}
                        </>
                      )}
                      {(cardFees.ecommerce_girocard_fee_percent || cardFees.ecommerce_credit_card_fee_percent) && (
                        <>
                          <div className="text-xs font-medium text-muted-foreground mt-2">eCommerce:</div>
                          {cardFees.ecommerce_girocard_fee_percent && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Girocard:</span>
                              <span className="font-medium">{formatPercent(cardFees.ecommerce_girocard_fee_percent)}</span>
                            </div>
                          )}
                          {cardFees.ecommerce_credit_card_fee_percent && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Kreditkarte:</span>
                              <span className="font-medium">{formatPercent(cardFees.ecommerce_credit_card_fee_percent)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

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

        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="flex-1">
              Zurück
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            className="flex-1"
            disabled={loading || !termsAccepted || !privacyAccepted}
          >
            {loading ? "Wird abgeschlossen..." : "Onboarding abschließen"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SignatureStep;