import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, Circle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DocumentsStepProps = {
  customerId: string;
  legalForm?: string;
  onComplete: () => void;
  onBack?: () => void;
};

type UploadedDoc = {
  type: string;
  fileName: string;
};

const DocumentsStep = ({ customerId, legalForm, onComplete, onBack }: DocumentsStepProps) => {
  const [loading, setLoading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [checklist, setChecklist] = useState<Record<string, { required: boolean; uploaded: boolean; markedAvailable: boolean; personName?: string }>>({}); 
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [authorizedPersons, setAuthorizedPersons] = useState<Array<{ id: string; first_name: string; last_name: string; country: string }>>([]);

  useEffect(() => {
    loadChecklist();
  }, [customerId, legalForm]);

  const loadChecklist = async () => {
    try {
      // Lade vertretungsberechtigte Personen
      const { data: authPersons } = await supabase
        .from("authorized_persons")
        .select("id, first_name, last_name, country")
        .eq("customer_id", customerId);

      setAuthorizedPersons(authPersons || []);

      // Lade hochgeladene Dokumente
      const { data: docs } = await supabase
        .from("documents")
        .select("document_type, person_id")
        .eq("customer_id", customerId);

      // Lade vorgemerkte Dokumente
      const { data: checklistItems } = await supabase
        .from("document_checklist")
        .select("document_type, marked_as_available, person_id")
        .eq("customer_id", customerId);

      const checklistMap: Record<string, { required: boolean; uploaded: boolean; markedAvailable: boolean; personName?: string }> = {};

      // Unternehmensdokumente basierend auf Rechtsform
      const companyDocs = getDocumentTypes();
      companyDocs.forEach(docType => {
        const isUploaded = docs?.some(d => d.document_type === docType.value && !d.person_id) || false;
        const isMarked = checklistItems?.find(c => c.document_type === docType.value && !c.person_id)?.marked_as_available || false;
        
        checklistMap[docType.value] = {
          required: true,
          uploaded: isUploaded,
          markedAvailable: isMarked,
        };
      });

      // Personenbezogene Dokumente
      authPersons?.forEach(person => {
        const personName = `${person.first_name} ${person.last_name}`.trim();
        
        // ID-Dokument prüfen - wenn bereits hochgeladen, nicht mehr anfordern
        const hasIdDocument = docs?.some(d => d.document_type === 'id_document' && d.person_id === person.id) || false;
        
        // Nur wenn noch kein ID-Dokument hochgeladen wurde, in Checklist aufnehmen
        if (!hasIdDocument) {
          const idKey = `id_document_${person.id}`;
          checklistMap[idKey] = {
            required: true,
            uploaded: false,
            markedAvailable: false,
            personName: `Ausweisdokument - ${personName}`,
          };
        }
        
        // Adressnachweis nur wenn Person außerhalb Deutschlands
        if (person.country && person.country !== 'DE') {
          const addressKey = `proof_of_address_${person.id}`;
          const addressUploaded = docs?.some(d => d.document_type === 'proof_of_address' && d.person_id === person.id) || false;
          const addressMarked = checklistItems?.find(c => c.document_type === 'proof_of_address' && c.person_id === person.id)?.marked_as_available || false;
          
          checklistMap[addressKey] = {
            required: true,
            uploaded: addressUploaded,
            markedAvailable: addressMarked,
            personName: `Adressnachweis - ${personName}`,
          };
        }
      });

      setChecklist(checklistMap);
    } catch (error: any) {
      // Silent fail - checklist will be empty
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedType) {
      toast.error("Bitte wählen Sie zunächst einen Dokumenttyp");
      return;
    }

    setLoading(true);

    try {
      // Bestimme den tatsächlichen Dokumenttyp
      let actualDocType = selectedType;
      let actualPersonId = selectedPersonId;
      
      // Wenn selectedType ein Key wie "id_document_UUID" ist, extrahiere die Info
      if (selectedType.startsWith('id_document_')) {
        actualDocType = 'id_document';
        actualPersonId = selectedType.replace('id_document_', '');
      } else if (selectedType.startsWith('proof_of_address_')) {
        actualDocType = 'proof_of_address';
        actualPersonId = selectedType.replace('proof_of_address_', '');
      }

      const fileExt = file.name.split(".").pop();
      const fileName = actualPersonId 
        ? `${customerId}/${actualPersonId}/${actualDocType}_${Date.now()}.${fileExt}`
        : `${customerId}/${Date.now()}_${actualDocType}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert([
        {
          customer_id: customerId,
          document_type: actualDocType as "commercial_register" | "transparency_register" | "articles_of_association" | "id_document" | "proof_of_address" | "other",
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          mime_type: file.type,
          person_id: actualPersonId,
        },
      ]);

      if (dbError) throw dbError;

      setUploadedDocs([...uploadedDocs, { type: selectedType, fileName: file.name }]);
      setSelectedType("");
      setSelectedPersonId(null);
      
      // Update checklist
      await loadChecklist();
      
      toast.success("Dokument hochgeladen");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Hochladen");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    // Prüfe ob noch erforderliche Dokumente fehlen
    const missingDocs = Object.entries(checklist).filter(
      ([_, status]) => status.required && !status.uploaded && !status.markedAvailable
    );
    
    if (missingDocs.length > 0) {
      toast.error("Bitte laden Sie alle erforderlichen Dokumente hoch");
      return;
    }
    
    onComplete();
  };

  const getDocumentTypes = () => {
    const baseTypes = [
      { value: "other", label: "Sonstiges" },
    ];

    // GmbH, AG, UG, KG, OHG → Handelsregister + Transparenzregister
    if (["gmbh", "ag", "ug", "kg", "ohg"].includes(legalForm || "")) {
      return [
        { value: "commercial_register", label: "Handelsregisterauszug" },
        { value: "transparency_register", label: "Transparenzregister" },
        ...baseTypes,
      ];
    }

    // Einzelunternehmen → Gewerbeanmeldung
    if (legalForm === "einzelunternehmen") {
      return [
        { value: "articles_of_association", label: "Gewerbeanmeldung" },
        ...baseTypes,
      ];
    }

    // Andere (z.B. Verein) → Registerauszug
    return [
      { value: "commercial_register", label: "Registerauszug" },
      ...baseTypes,
    ];
  };

  const documentTypes = getDocumentTypes();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dokumente</CardTitle>
        <CardDescription>
          Laden Sie die erforderlichen Nachweise hoch (abhängig von Ihrer Rechtsform)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Checkliste der benötigten Dokumente */}
        <div className="space-y-2">
          <Label>Erforderliche Dokumente</Label>
          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
            {Object.entries(checklist).map(([key, status]) => {
              const isUploaded = status.uploaded;
              const isMarkedAvailable = status.markedAvailable;
              const displayName = status.personName || documentTypes.find(dt => dt.value === key)?.label || key;
              
              return (
                <div key={key} className="flex items-center gap-3 p-2">
                  {isUploaded ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : isMarkedAvailable ? (
                    <CheckCircle2 className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`text-sm ${isUploaded ? 'text-green-600 font-medium' : isMarkedAvailable ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {displayName}
                    {isMarkedAvailable && !isUploaded && " (vorgemerkt)"}
                    {isUploaded && " (hochgeladen)"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Dokumenttyp</Label>
            <Select value={selectedType} onValueChange={(value) => {
              setSelectedType(value);
              // Wenn ID-Dokument ausgewählt, prüfe ob es für eine Person ist
              if (value.startsWith('id_document_')) {
                const personId = value.replace('id_document_', '');
                setSelectedPersonId(personId);
              } else if (value.startsWith('proof_of_address_')) {
                const personId = value.replace('proof_of_address_', '');
                setSelectedPersonId(personId);
              } else {
                setSelectedPersonId(null);
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Typ auswählen" />
              </SelectTrigger>
              <SelectContent>
                {/* Unternehmensdokumente */}
                {documentTypes
                  .filter(type => !checklist[type.value]?.uploaded && !checklist[type.value]?.markedAvailable)
                  .map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                
                {/* Personenbezogene Dokumente aus der Checkliste */}
                {Object.entries(checklist)
                  .filter(([key, status]) => 
                    (key.startsWith('id_document_') || key.startsWith('proof_of_address_')) && 
                    !status.uploaded && 
                    !status.markedAvailable
                  )
                  .map(([key, status]) => (
                    <SelectItem key={key} value={key}>
                      {status.personName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>


          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <Label
              htmlFor="file-upload"
              className="cursor-pointer text-primary hover:underline"
            >
              Datei auswählen
            </Label>
            <Input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={!selectedType || loading}
            />
            <p className="text-sm text-muted-foreground mt-2">
              PDF, JPG oder PNG (max. 10 MB)
            </p>
          </div>
        </div>

        {uploadedDocs.length > 0 && (
          <div className="space-y-2">
            <Label>Hochgeladene Dokumente</Label>
            <div className="space-y-2">
              {uploadedDocs.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                >
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {documentTypes.find((t) => t.value === doc.type)?.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="flex-1">
              Zurück
            </Button>
          )}
          <Button
            onClick={handleComplete}
            className="flex-1"
            disabled={loading}
          >
            Weiter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentsStep;