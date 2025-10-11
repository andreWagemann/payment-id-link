import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type AuthorizedPersonsStepProps = {
  customerId: string;
  onComplete: () => void;
  onBack?: () => void;
};

type Person = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  email: string;
  street: string;
  postal_code: string;
  city: string;
};

const AuthorizedPersonsStep = ({ customerId, onComplete, onBack }: AuthorizedPersonsStepProps) => {
  const [loading, setLoading] = useState(false);
  const [authorizedPersons, setAuthorizedPersons] = useState<Person[]>([
    {
      first_name: "",
      last_name: "",
      date_of_birth: "",
      nationality: "DE",
      email: "",
      street: "",
      postal_code: "",
      city: "",
    },
  ]);

  useEffect(() => {
    loadExistingPersons();
  }, [customerId]);

  const loadExistingPersons = async () => {
    try {
      const { data: authPersons } = await supabase
        .from("authorized_persons")
        .select("*")
        .eq("customer_id", customerId);

      if (authPersons && authPersons.length > 0) {
        setAuthorizedPersons(
          authPersons.map((p) => ({
            first_name: p.first_name || "",
            last_name: p.last_name || "",
            date_of_birth: p.date_of_birth || "",
            nationality: p.nationality || "DE",
            email: p.email || "",
            street: p.street || "",
            postal_code: p.postal_code || "",
            city: p.city || "",
          }))
        );
      }
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasValidPerson = authorizedPersons.some((p) => p.first_name && p.last_name);

    if (!hasValidPerson) {
      toast.error("Bitte geben Sie mindestens eine vertretungsberechtigte Person an");
      return;
    }

    setLoading(true);

    try {
      await supabase.from("authorized_persons").delete().eq("customer_id", customerId);

      const authPersonsData = authorizedPersons
        .filter((p) => p.first_name && p.last_name)
        .map((p) => ({
          customer_id: customerId,
          ...p,
        }));

      if (authPersonsData.length > 0) {
        const { error: authError } = await supabase
          .from("authorized_persons")
          .insert(authPersonsData);

        if (authError) throw authError;
      }

      toast.success("Vertretungsberechtigte gespeichert");
      onComplete();
    } catch (error: any) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const addPerson = () => {
    setAuthorizedPersons([
      ...authorizedPersons,
      {
        first_name: "",
        last_name: "",
        date_of_birth: "",
        nationality: "DE",
        email: "",
        street: "",
        postal_code: "",
        city: "",
      },
    ]);
  };

  const removePerson = (index: number) => {
    setAuthorizedPersons(authorizedPersons.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vertretungsberechtigte Personen</CardTitle>
        <CardDescription>
          Geben Sie die Personen an, die Ihr Unternehmen vertreten dürfen
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Was sind vertretungsberechtigte Personen?</strong>
            <br />
            Das sind Personen, die berechtigt sind, das Unternehmen nach außen zu vertreten und
            Verträge zu unterschreiben. Bei einer GmbH sind das zum Beispiel die Geschäftsführer,
            bei einer AG die Vorstandsmitglieder. Diese Personen sind in der Regel im
            Handelsregister eingetragen.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 mb-6">
            {authorizedPersons.map((person, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Person {index + 1}</h4>
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePerson(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vorname *</Label>
                    <Input
                      value={person.first_name}
                      onChange={(e) => {
                        const updated = [...authorizedPersons];
                        updated[index].first_name = e.target.value;
                        setAuthorizedPersons(updated);
                      }}
                      required={index === 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nachname *</Label>
                    <Input
                      value={person.last_name}
                      onChange={(e) => {
                        const updated = [...authorizedPersons];
                        updated[index].last_name = e.target.value;
                        setAuthorizedPersons(updated);
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
                      value={person.date_of_birth}
                      onChange={(e) => {
                        const updated = [...authorizedPersons];
                        updated[index].date_of_birth = e.target.value;
                        setAuthorizedPersons(updated);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-Mail</Label>
                    <Input
                      type="email"
                      value={person.email}
                      onChange={(e) => {
                        const updated = [...authorizedPersons];
                        updated[index].email = e.target.value;
                        setAuthorizedPersons(updated);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addPerson} className="w-full mb-4">
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

export default AuthorizedPersonsStep;