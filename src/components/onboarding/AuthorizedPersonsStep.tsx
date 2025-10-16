import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Info, Upload, CheckCircle2, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { authorizedPersonSchema } from "@/lib/validationSchemas";

type AuthorizedPersonsStepProps = {
  customerId: string;
  onComplete: () => void;
  onBack?: () => void;
};

type Person = {
  id?: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  place_of_birth: string;
  nationality: string;
  email: string;
  private_street: string;
  private_postal_code: string;
  private_city: string;
  private_country: string;
  id_document_number: string;
  id_document_issue_date: string;
  id_document_issuing_authority: string;
  document_uploaded?: boolean;
  document_file_name?: string;
  id_document_available?: boolean;
};

const AuthorizedPersonsStep = ({ customerId, onComplete, onBack }: AuthorizedPersonsStepProps) => {
  const [loading, setLoading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [authorizedPersons, setAuthorizedPersons] = useState<Person[]>([
    {
      first_name: "",
      last_name: "",
      date_of_birth: "",
      place_of_birth: "",
      nationality: "DE",
      email: "",
      private_street: "",
      private_postal_code: "",
      private_city: "",
      private_country: "DE",
      id_document_number: "",
      id_document_issue_date: "",
      id_document_issuing_authority: "",
      document_uploaded: false,
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
        // Load document upload status and checklist status for each person
        const personsWithDocs = await Promise.all(
          authPersons.map(async (p) => {
            const { data: docs } = await supabase
              .from("documents")
              .select("file_name")
              .eq("customer_id", customerId)
              .eq("person_id", p.id)
              .eq("document_type", "id_document")
              .maybeSingle();

            // Check if document is marked as available in checklist
            const { data: checklist } = await supabase
              .from("document_checklist")
              .select("marked_as_available")
              .eq("customer_id", customerId)
              .eq("person_id", p.id)
              .eq("document_type", "id_document")
              .maybeSingle();

            return {
              id: p.id,
              first_name: p.first_name || "",
              last_name: p.last_name || "",
              date_of_birth: p.date_of_birth || "",
              place_of_birth: p.place_of_birth || "",
              nationality: p.nationality || "DE",
              email: p.email || "",
              private_street: p.private_street || "",
              private_postal_code: p.private_postal_code || "",
              private_city: p.private_city || "",
              private_country: p.private_country || "DE",
              id_document_number: p.id_document_number || "",
              id_document_issue_date: p.id_document_issue_date || "",
              id_document_issuing_authority: p.id_document_issuing_authority || "",
              document_uploaded: !!docs,
              document_file_name: docs?.file_name,
              id_document_available: checklist?.marked_as_available || false,
            };
          })
        );
        setAuthorizedPersons(personsWithDocs);
      }
    } catch (error: any) {
      // Silent fail - user can still enter data
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, personIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Nur PDF, JPG oder PNG Dateien sind erlaubt");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Datei ist zu groß. Maximum 10 MB");
      return;
    }

    setUploadingIndex(personIndex);

    try {
      const person = authorizedPersons[personIndex];
      
      // First, save the person to get their ID if they don't have one
      let personId = person.id;
      
      if (!personId) {
        const { data: savedPerson, error: saveError } = await supabase
          .from("authorized_persons")
          .insert([{
            customer_id: customerId,
            first_name: person.first_name || "temp",
            last_name: person.last_name || "temp",
            date_of_birth: person.date_of_birth || null,
            place_of_birth: person.place_of_birth || null,
            nationality: person.nationality || "DE",
            email: person.email || null,
            private_street: person.private_street || null,
            private_postal_code: person.private_postal_code || null,
            private_city: person.private_city || null,
            private_country: person.private_country || "DE",
            id_document_number: person.id_document_number || null,
            id_document_issue_date: person.id_document_issue_date || null,
            id_document_issuing_authority: person.id_document_issuing_authority || null,
          }])
          .select()
          .single();

        if (saveError) throw saveError;
        personId = savedPerson.id;

        // Update local state with the new ID
        const updated = [...authorizedPersons];
        updated[personIndex].id = personId;
        setAuthorizedPersons(updated);
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${customerId}/${personId}/id_document_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert([
        {
          customer_id: customerId,
          person_id: personId,
          document_type: "id_document",
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          mime_type: file.type,
        },
      ]);

      if (dbError) throw dbError;

      // Update local state
      const updated = [...authorizedPersons];
      updated[personIndex].document_uploaded = true;
      updated[personIndex].document_file_name = file.name;
      setAuthorizedPersons(updated);

      toast.success("Ausweisdokument hochgeladen");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Hochladen");
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasValidPerson = authorizedPersons.some((p) => p.first_name && p.last_name);

    if (!hasValidPerson) {
      toast.error("Bitte geben Sie mindestens eine vertretungsberechtigte Person an");
      return;
    }

    // Validate each person with complete data
    const personsToSave = authorizedPersons.filter((p) => p.first_name && p.last_name);
    
    for (let i = 0; i < personsToSave.length; i++) {
      const person = personsToSave[i];
      const validationResult = authorizedPersonSchema.safeParse({
        ...person,
        email: person.email || undefined,
      });
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(`Person ${i + 1}: ${firstError.message}`);
        return;
      }

      // Check if document is uploaded or marked as available
      if (!person.document_uploaded && !person.id_document_available) {
        toast.error(`Person ${i + 1}: Bitte laden Sie ein Ausweisdokument hoch`);
        return;
      }
    }

    setLoading(true);

    try {
      // Delete old entries and insert new ones
      await supabase.from("authorized_persons").delete().eq("customer_id", customerId);

      const authPersonsData = personsToSave.map((p) => ({
        customer_id: customerId,
        id: p.id, // Keep existing ID if available
        first_name: p.first_name,
        last_name: p.last_name,
        date_of_birth: p.date_of_birth,
        place_of_birth: p.place_of_birth,
        nationality: p.nationality,
        email: p.email || null,
        private_street: p.private_street,
        private_postal_code: p.private_postal_code,
        private_city: p.private_city,
        private_country: p.private_country,
        id_document_number: p.id_document_number,
        id_document_issue_date: p.id_document_issue_date,
        id_document_issuing_authority: p.id_document_issuing_authority,
      }));

      if (authPersonsData.length > 0) {
        const { error: authError } = await supabase
          .from("authorized_persons")
          .upsert(authPersonsData);

        if (authError) throw authError;
      }

      toast.success("Vertretungsberechtigte gespeichert");
      onComplete();
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Speichern");
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
        place_of_birth: "",
        nationality: "DE",
        email: "",
        private_street: "",
        private_postal_code: "",
        private_city: "",
        private_country: "DE",
        id_document_number: "",
        id_document_issue_date: "",
        id_document_issuing_authority: "",
        document_uploaded: false,
      },
    ]);
  };

  const removePerson = (index: number) => {
    setAuthorizedPersons(authorizedPersons.filter((_, i) => i !== index));
  };

  const updatePerson = (index: number, field: keyof Person, value: string) => {
    const updated = [...authorizedPersons];
    updated[index] = { ...updated[index], [field]: value };
    setAuthorizedPersons(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vertretungsberechtigte Personen</CardTitle>
        <CardDescription>
          Geben Sie die Personen an, die Ihr Unternehmen vertreten dürfen (gemäß Geldwäschegesetz)
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
            bei einer AG die Vorstandsmitglieder. Gemäß GWG müssen vollständige Angaben inklusive
            Ausweisdokument für jede Person vorliegen.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 mb-6">
            {authorizedPersons.map((person, index) => (
              <div key={index} className="p-6 border-2 rounded-lg space-y-6 bg-muted/20">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">Person {index + 1}</h4>
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

                {/* Persönliche Daten */}
                <div className="space-y-4">
                  <h5 className="font-medium text-sm text-muted-foreground">Persönliche Daten</h5>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Vorname *</Label>
                      <Input
                        value={person.first_name}
                        onChange={(e) => updatePerson(index, "first_name", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nachname *</Label>
                      <Input
                        value={person.last_name}
                        onChange={(e) => updatePerson(index, "last_name", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Geburtsdatum *</Label>
                      <Input
                        type="date"
                        value={person.date_of_birth}
                        onChange={(e) => updatePerson(index, "date_of_birth", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Geburtsort *</Label>
                      <Input
                        value={person.place_of_birth}
                        onChange={(e) => updatePerson(index, "place_of_birth", e.target.value)}
                        placeholder="z.B. Berlin"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Staatsangehörigkeit *</Label>
                      <Input
                        value={person.nationality}
                        onChange={(e) => updatePerson(index, "nationality", e.target.value.toUpperCase())}
                        placeholder="DE"
                        maxLength={2}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>E-Mail (optional)</Label>
                      <Input
                        type="email"
                        value={person.email}
                        onChange={(e) => updatePerson(index, "email", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Privatadresse */}
                <div className="space-y-4">
                  <h5 className="font-medium text-sm text-muted-foreground">Privatadresse</h5>
                  
                  <div className="space-y-2">
                    <Label>Straße & Hausnummer *</Label>
                    <Input
                      value={person.private_street}
                      onChange={(e) => updatePerson(index, "private_street", e.target.value)}
                      placeholder="z.B. Musterstraße 123"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Postleitzahl *</Label>
                      <Input
                        value={person.private_postal_code}
                        onChange={(e) => updatePerson(index, "private_postal_code", e.target.value)}
                        placeholder="12345"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stadt *</Label>
                      <Input
                        value={person.private_city}
                        onChange={(e) => updatePerson(index, "private_city", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Land *</Label>
                      <Input
                        value={person.private_country}
                        onChange={(e) => updatePerson(index, "private_country", e.target.value.toUpperCase())}
                        placeholder="DE"
                        maxLength={2}
                        required
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Ausweisdaten */}
                <div className="space-y-4">
                  <h5 className="font-medium text-sm text-muted-foreground">Ausweisdaten</h5>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ausweisnummer *</Label>
                      <Input
                        value={person.id_document_number}
                        onChange={(e) => updatePerson(index, "id_document_number", e.target.value)}
                        placeholder="z.B. T12345678"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ausstellungsdatum *</Label>
                      <Input
                        type="date"
                        value={person.id_document_issue_date}
                        onChange={(e) => updatePerson(index, "id_document_issue_date", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Ausstellende Behörde *</Label>
                    <Input
                      value={person.id_document_issuing_authority}
                      onChange={(e) => updatePerson(index, "id_document_issuing_authority", e.target.value)}
                      placeholder="z.B. Stadt Berlin"
                      required
                    />
                  </div>
                </div>

                <Separator />

                {/* Ausweisdokument Upload */}
                <div className="space-y-4">
                  <h5 className="font-medium text-sm text-muted-foreground">Ausweisdokument *</h5>
                  
                  {person.id_document_available ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">Ausweis liegt vor</p>
                        <p className="text-xs text-green-700">Das Ausweisdokument wurde vom Vertriebler als vorliegend markiert</p>
                      </div>
                    </div>
                  ) : person.document_uploaded ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-900">Dokument hochgeladen</p>
                        <p className="text-xs text-green-700">{person.document_file_name}</p>
                      </div>
                      <Label
                        htmlFor={`file-upload-${index}`}
                        className="cursor-pointer text-sm text-primary hover:underline"
                      >
                        Ersetzen
                      </Label>
                      <Input
                        id={`file-upload-${index}`}
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, index)}
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={uploadingIndex !== null}
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <Label
                        htmlFor={`file-upload-${index}`}
                        className="cursor-pointer text-primary hover:underline"
                      >
                        {uploadingIndex === index ? "Wird hochgeladen..." : "Ausweis hochladen"}
                      </Label>
                      <Input
                        id={`file-upload-${index}`}
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, index)}
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={uploadingIndex !== null}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        PDF, JPG oder PNG (max. 10 MB)
                      </p>
                    </div>
                  )}
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
            <Button type="submit" className="flex-1" disabled={loading || uploadingIndex !== null}>
              {loading ? "Wird gespeichert..." : "Weiter"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AuthorizedPersonsStep;
