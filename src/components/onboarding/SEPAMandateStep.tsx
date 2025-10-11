import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
    account_holder: companyName,
  });
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
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
          account_holder: data.account_holder || companyName,
        });
        setAccepted(data.accepted || false);
      }
    } catch (error) {
      console.error("Fehler beim Laden des Mandats:", error);
    }
  };

  const formatIBAN = (value: string) => {
    const cleaned = value.replace(/\s/g, "").toUpperCase();
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    return formatted;
  };

  const handleSubmit = async () => {
    if (!formData.iban || !formData.account_holder) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    if (!accepted) {
      toast.error("Bitte akzeptieren Sie das SEPA-Lastschriftmandat");
      return;
    }

    setLoading(true);

    try {
      const mandateReference = `MANDATE-${nanoid(10)}`;
      const cleanedIban = formData.iban.replace(/\s/g, "");

      const { error } = await supabase
        .from("sepa_mandates")
        .upsert([
          {
            customer_id: customerId,
            iban: cleanedIban,
            bic: formData.bic || null,
            bank_name: formData.bank_name || null,
            account_holder: formData.account_holder,
            mandate_reference: mandateReference,
            accepted: true,
            accepted_at: new Date().toISOString(),
          },
        ], { onConflict: 'customer_id' });

      if (error) throw error;

      toast.success("SEPA-Mandat gespeichert");
      onComplete();
    } catch (error: any) {
      toast.error("Fehler beim Speichern des Mandats");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SEPA-Lastschriftmandat</CardTitle>
        <CardDescription>
          Bitte geben Sie Ihre Bankdaten ein und akzeptieren Sie das SEPA-Lastschriftmandat
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
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="iban">IBAN *</Label>
            <Input
              id="iban"
              value={formData.iban}
              onChange={(e) => setFormData({ ...formData, iban: formatIBAN(e.target.value) })}
              placeholder="DE89 3704 0044 0532 0130 00"
              maxLength={34}
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
                maxLength={11}
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

        <div className="p-4 bg-muted rounded-lg space-y-4">
          <h3 className="font-medium">SEPA-Lastschriftmandat</h3>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p>
              Ich ermächtige (Wir ermächtigen) die [Ihr Firmenname], Zahlungen von meinem (unserem) Konto
              mittels Lastschrift einzuziehen. Zugleich weise ich mein (weisen wir unser) Kreditinstitut an,
              die von [Ihr Firmenname] auf mein (unser) Konto gezogenen Lastschriften einzulösen.
            </p>
            <p className="font-medium">Hinweis:</p>
            <p>
              Ich kann (Wir können) innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die
              Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem (unserem)
              Kreditinstitut vereinbarten Bedingungen.
            </p>
            <p className="text-xs mt-4">
              Gläubiger-Identifikationsnummer: [Ihre Gläubiger-ID]<br />
              Mandatsreferenz: Wird nach Bestätigung automatisch generiert
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="mandate-accept"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(!!checked)}
          />
          <label
            htmlFor="mandate-accept"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Ich akzeptiere das SEPA-Lastschriftmandat und bestätige die Richtigkeit meiner Angaben *
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
            disabled={loading || !accepted || !formData.iban || !formData.account_holder}
          >
            {loading ? "Wird gespeichert..." : "Weiter"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SEPAMandateStep;
