import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type BeneficialOwnersStepProps = {
  customerId: string;
  onComplete: () => void;
  onBack?: () => void;
};

type BeneficialOwner = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  street: string;
  postal_code: string;
  city: string;
  ownership_percentage: string;
};

const BeneficialOwnersStep = ({ customerId, onComplete, onBack }: BeneficialOwnersStepProps) => {
  const [loading, setLoading] = useState(false);
  const [beneficialOwners, setBeneficialOwners] = useState<BeneficialOwner[]>([
    {
      first_name: "",
      last_name: "",
      date_of_birth: "",
      nationality: "DE",
      street: "",
      postal_code: "",
      city: "",
      ownership_percentage: "",
    },
  ]);

  useEffect(() => {
    loadExistingOwners();
  }, [customerId]);

  const loadExistingOwners = async () => {
    try {
      const { data: benOwners } = await supabase
        .from("beneficial_owners")
        .select("*")
        .eq("customer_id", customerId);

      if (benOwners && benOwners.length > 0) {
        setBeneficialOwners(
          benOwners.map((p) => ({
            first_name: p.first_name || "",
            last_name: p.last_name || "",
            date_of_birth: p.date_of_birth || "",
            nationality: p.nationality || "DE",
            street: p.street || "",
            postal_code: p.postal_code || "",
            city: p.city || "",
            ownership_percentage: p.ownership_percentage?.toString() || "",
          }))
        );
      }
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasValidOwner = beneficialOwners.some((p) => p.first_name && p.last_name);

    if (!hasValidOwner) {
      toast.error("Bitte geben Sie mindestens eine wirtschaftlich berechtigte Person an");
      return;
    }

    setLoading(true);

    try {
      await supabase.from("beneficial_owners").delete().eq("customer_id", customerId);

      const beneficialOwnersData = beneficialOwners
        .filter((p) => p.first_name && p.last_name)
        .map((p) => ({
          customer_id: customerId,
          ...p,
          ownership_percentage: parseFloat(p.ownership_percentage) || null,
        }));

      if (beneficialOwnersData.length > 0) {
        const { error: benError } = await supabase
          .from("beneficial_owners")
          .insert(beneficialOwnersData);

        if (benError) throw benError;
      }

      toast.success("Wirtschaftlich Berechtigte gespeichert");
      onComplete();
    } catch (error: any) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const addOwner = () => {
    setBeneficialOwners([
      ...beneficialOwners,
      {
        first_name: "",
        last_name: "",
        date_of_birth: "",
        nationality: "DE",
        street: "",
        postal_code: "",
        city: "",
        ownership_percentage: "",
      },
    ]);
  };

  const removeOwner = (index: number) => {
    setBeneficialOwners(beneficialOwners.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wirtschaftlich Berechtigte</CardTitle>
        <CardDescription>
          Geben Sie alle Personen an, die wirtschaftlich von Ihrem Unternehmen profitieren
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Was sind wirtschaftlich Berechtigte?</strong>
            <br />
            Wirtschaftlich Berechtigte sind natürliche Personen, die letztendlich Eigentümer oder
            Kontrollinhaber eines Unternehmens sind. In der Regel sind das Personen, die mehr als
            25% der Anteile halten oder anderweitig maßgeblichen Einfluss auf das Unternehmen
            ausüben. Diese Angaben sind gesetzlich vorgeschrieben (Geldwäschegesetz) und werden im
            Transparenzregister eingetragen.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 mb-6">
            {beneficialOwners.map((owner, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Person {index + 1}</h4>
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOwner(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vorname *</Label>
                    <Input
                      value={owner.first_name}
                      onChange={(e) => {
                        const updated = [...beneficialOwners];
                        updated[index].first_name = e.target.value;
                        setBeneficialOwners(updated);
                      }}
                      required={index === 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nachname *</Label>
                    <Input
                      value={owner.last_name}
                      onChange={(e) => {
                        const updated = [...beneficialOwners];
                        updated[index].last_name = e.target.value;
                        setBeneficialOwners(updated);
                      }}
                      required={index === 0}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Geburtsdatum</Label>
                    <Input
                      type="date"
                      value={owner.date_of_birth}
                      onChange={(e) => {
                        const updated = [...beneficialOwners];
                        updated[index].date_of_birth = e.target.value;
                        setBeneficialOwners(updated);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Beteiligung (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={owner.ownership_percentage}
                      onChange={(e) => {
                        const updated = [...beneficialOwners];
                        updated[index].ownership_percentage = e.target.value;
                        setBeneficialOwners(updated);
                      }}
                      placeholder="z.B. 50"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addOwner} className="w-full mb-4">
            <Plus className="h-4 w-4 mr-2" />
            Weitere Person hinzufügen
          </Button>

          <div className="flex gap-2">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack} className="flex-1">
                Zurück
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Wird gespeichert..." : "Weiter"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default BeneficialOwnersStep;