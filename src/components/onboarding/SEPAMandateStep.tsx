import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { nanoid } from "nanoid";

type SEPAMandateStepProps = {
  customerId: string;
  companyName: string;
  onComplete: () => void;
  onBack?: () => void;
};

const SEPAMandateStep = ({ customerId, companyName, onComplete, onBack }: SEPAMandateStepProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    iban: "",
    bic: "",
    bank_name: "",
    account_holder: companyName || "",
    accepted: false,
  });
  const [mandateReference, setMandateReference] = useState("");

  useEffect(() => {
    // Generiere Mandatsreferenz
    const reference = `MAND-${nanoid(10).toUpperCase()}`;
    setMandateReference(reference);

    // Lade existierendes Mandat falls vorhanden
    loadExistingMandate();
  }, [customerId]);

  const loadExistingMandate = async () => {
    try {
      const { data } = await supabase
        .from("sepa_mandates")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();

      if (data) {
        setFormData({
          iban: data.iban || "",
          bic: data.bic || "",
          bank_name: data.bank_name || "",
          account_holder: data.account_holder || "",
          accepted: data.accepted || false,
        });
        setMandateReference(data.mandate_reference);
      }
    } catch (error) {
      console.error("Fehler beim Laden des Mandats:", error);
    }
  };

  const formatIBAN = (value: string) => {
    // Entferne alle Leerzeichen und mache Großbuchstaben
    const cleaned = value.replace(/\s/g, "").toUpperCase();
    // Füge alle 4 Zeichen ein Leerzeichen ein
    return cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
  };

  const handleIBANChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIBAN(e.target.value);
    setFormData({ ...formData, iban: formatted });
  };

  const validateIBAN = (iban: string) => {
    // Einfache IBAN-Validierung (DE hat 22 Zeichen)
    const cleaned = iban.replace(/\s/g, "");
    if (cleaned.startsWith("DE")) {
      return cleaned.length === 22;
    }
    return cleaned.length >= 15 && cleaned.length <= 34;
  };

  const handleSubmit = async () => {
    if (!formData.iban || !formData.account_holder) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    if (!validateIBAN(formData.iban)) {
      toast.error("Bitte geben Sie eine gültige IBAN ein");
      return;
    }

    if (!formData.accepted) {
      toast.error("Bitte akzeptieren Sie das SEPA-Lastschriftmandat");
      return;
    }

    setLoading(true);

    try {
      const mandateData = {
        customer_id: customerId,
        iban: formData.iban.replace(/\s/g, ""),
        bic: formData.bic || null,
        bank_name: formData.bank_name || null,
        account_holder: formData.account_holder,
        mandate_reference: mandateReference,
        accepted: formData.accepted,
        accepted_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("sepa_mandates")
        .upsert([mandateData], { onConflict: "customer_id" });

      if (error) throw error;

      toast.success("SEPA-Mandat gespeichert");
      onComplete();
    } catch (error: any) {
      toast.error("Fehler beim Speichern");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const mandateText = `
SEPA-Lastschriftmandat

Mandatsreferenz: ${mandateReference}
Gläubiger-Identifikationsnummer: DE98ZZZ09999999999 (Beispiel)

Ich ermächtige Payment AG, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. 
Zugleich weise ich mein Kreditinstitut an, die von Payment AG auf mein Konto gezogenen 
Lastschriften einzulösen.

Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des 
belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen.
  `.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>SEPA-Lastschriftmandat</CardTitle>
        <CardDescription>
          Bitte geben Sie Ihre Bankverbindung ein und akzeptieren Sie das SEPA-Mandat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account_holder">Kontoinhaber *</Label>
            <Input
              id="account_holder"
              value={formData.account_holder}
              onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
              placeholder="Max Mustermann GmbH"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="iban">IBAN *</Label>
            <Input
              id="iban"
              value={formData.iban}
              onChange={handleIBANChange}
              placeholder="DE89 3704 0044 0532 0130 00"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bic">BIC (optional)</Label>
              <Input
                id="bic"
                value={formData.bic}
                onChange={(e) => setFormData({ ...formData, bic: e.target.value.toUpperCase() })}
                placeholder="COBADEFFXXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_name">Bankname (optional)</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="Commerzbank"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <h3 className="font-medium mb-2">SEPA-Lastschriftmandat</h3>
          <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground">
            {mandateText}
          </pre>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="accept-mandate"
            checked={formData.accepted}
            onCheckedChange={(checked) => setFormData({ ...formData, accepted: !!checked })}
          />
          <label
            htmlFor="accept-mandate"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Ich akzeptiere das SEPA-Lastschriftmandat und ermächtige Payment AG, 
            Zahlungen von meinem Konto mittels Lastschrift einzuziehen.
          </label>
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
            disabled={loading || !formData.accepted}
          >
            {loading ? "Wird gespeichert..." : "Weiter"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SEPAMandateStep;
