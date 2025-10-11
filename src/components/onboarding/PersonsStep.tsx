import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PersonsStepProps = {
  customerId: string;
  onComplete: () => void;
};

type Person = {
  id?: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  email: string;
  street: string;
  postal_code: string;
  city: string;
};

type BeneficialOwner = Person & {
  ownership_percentage: string;
};

const PersonsStep = ({ customerId, onComplete }: PersonsStepProps) => {
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
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
  const [beneficialOwners, setBeneficialOwners] = useState<BeneficialOwner[]>([
    {
      first_name: "",
      last_name: "",
      date_of_birth: "",
      nationality: "DE",
      email: "",
      street: "",
      postal_code: "",
      city: "",
      ownership_percentage: "",
    },
  ]);

  useEffect(() => {
    loadExistingPersons();
  }, [customerId]);

  const loadExistingPersons = async () => {
    try {
      // Lade bereits vorerfasste Personen vom Vertrieb
      const { data: authPersons } = await supabase
        .from("authorized_persons")
        .select("*")
        .eq("customer_id", customerId);

      const { data: benOwners } = await supabase
        .from("beneficial_owners")
        .select("*")
        .eq("customer_id", customerId);

      if (authPersons && authPersons.length > 0) {
        setAuthorizedPersons(authPersons.map((p) => ({
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          date_of_birth: p.date_of_birth || "",
          nationality: p.nationality || "DE",
          email: p.email || "",
          street: p.street || "",
          postal_code: p.postal_code || "",
          city: p.city || "",
        })));
      }

      if (benOwners && benOwners.length > 0) {
        setBeneficialOwners(benOwners.map((p) => ({
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          date_of_birth: p.date_of_birth || "",
          nationality: p.nationality || "DE",
          email: "",
          street: p.street || "",
          postal_code: p.postal_code || "",
          city: p.city || "",
          ownership_percentage: p.ownership_percentage?.toString() || "",
        })));
      }

      setInitialLoadDone(true);
    } catch (error) {
      console.error("Fehler beim Laden der Personen:", error);
      setInitialLoadDone(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validierung: mindestens eine Person muss vollständig ausgefüllt sein
    const hasValidAuthPerson = authorizedPersons.some(
      (p) => p.first_name && p.last_name
    );
    const hasValidBenOwner = beneficialOwners.some((p) => p.first_name && p.last_name);

    if (!hasValidAuthPerson && !hasValidBenOwner) {
      toast.error("Bitte geben Sie mindestens eine Person an");
      return;
    }

    setLoading(true);

    try {
      // Lösche alte Einträge und füge neue hinzu
      await supabase
        .from("authorized_persons")
        .delete()
        .eq("customer_id", customerId);

      await supabase
        .from("beneficial_owners")
        .delete()
        .eq("customer_id", customerId);
      // Speichere vertretungsberechtigte Personen
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

      // Speichere wirtschaftlich Berechtigte
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

      toast.success("Personen gespeichert");
      onComplete();
    } catch (error: any) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const addAuthorizedPerson = () => {
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

  const removeAuthorizedPerson = (index: number) => {
    setAuthorizedPersons(authorizedPersons.filter((_, i) => i !== index));
  };

  const addBeneficialOwner = () => {
    setBeneficialOwners([
      ...beneficialOwners,
      {
        first_name: "",
        last_name: "",
        date_of_birth: "",
        nationality: "DE",
        email: "",
        street: "",
        postal_code: "",
        city: "",
        ownership_percentage: "",
      },
    ]);
  };

  const removeBeneficialOwner = (index: number) => {
    setBeneficialOwners(beneficialOwners.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personen</CardTitle>
        <CardDescription>
          {initialLoadDone && (authorizedPersons.some((p) => p.first_name) || beneficialOwners.some((p) => p.first_name))
            ? "Überprüfen und vervollständigen Sie die Angaben"
            : "Geben Sie vertretungsberechtigte Personen und wirtschaftlich Berechtigte an (mindestens eine Person erforderlich)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="authorized">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="authorized">Vertretungsberechtigte</TabsTrigger>
              <TabsTrigger value="beneficial">Wirtschaftlich Berechtigte</TabsTrigger>
            </TabsList>

            <TabsContent value="authorized" className="space-y-4 mt-6">
              {authorizedPersons.map((person, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Person {index + 1}</h4>
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAuthorizedPerson(index)}
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

              <Button
                type="button"
                variant="outline"
                onClick={addAuthorizedPerson}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Weitere Person hinzufügen
              </Button>
            </TabsContent>

            <TabsContent value="beneficial" className="space-y-4 mt-6">
              {beneficialOwners.map((owner, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Person {index + 1}</h4>
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBeneficialOwner(index)}
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
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addBeneficialOwner}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Weitere Person hinzufügen
              </Button>
            </TabsContent>
          </Tabs>

          <Button type="submit" className="w-full mt-6" disabled={loading}>
            {loading ? "Wird gespeichert..." : "Weiter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PersonsStep;