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
  const [checklist, setChecklist] = useState<Record<string, { required: boolean; uploaded: boolean; markedAvailable: boolean }>>({});

  useEffect(() => {
    loadChecklist();
  }, [customerId, legalForm]);

  const loadChecklist = async () => {
    try {
      // Lade hochgeladene Dokumente
      const { data: docs } = await supabase
        .from("documents")
        .select("document_type")
        .eq("customer_id", customerId);

      // Lade vorgemerkte Dokumente
      const { data: checklistItems } = await supabase
        .from("document_checklist")
        .select("document_type, marked_as_available")
        .eq("customer_id", customerId);

      const requiredDocs = getDocumentTypes();
      const checklistMap: Record<string, { required: boolean; uploaded: boolean; markedAvailable: boolean }> = {};

      requiredDocs.forEach(docType => {
        const isUploaded = docs?.some(d => d.document_type === docType.value) || false;
        const isMarked = checklistItems?.find(c => c.document_type === docType.value)?.marked_as_available || false;
        
        checklistMap[docType.value] = {
          required: true,
          uploaded: isUploaded,
          markedAvailable: isMarked,
        };
      });

      setChecklist(checklistMap);
      setUploadedDocs(docs?.map(d => ({ type: d.document_type, fileName: '' })) || []);
    } catch (error) {
      console.error("Fehler beim Laden der Checkliste:", error);
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
      const fileExt = file.name.split(".").pop();
      const fileName = `${customerId}/${Date.now()}_${selectedType}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documents").insert([
        {
          customer_id: customerId,
          document_type: selectedType as "commercial_register" | "transparency_register" | "articles_of_association" | "id_document" | "proof_of_address" | "other",
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          mime_type: file.type,
        },
      ]);

      if (dbError) throw dbError;

      setUploadedDocs([...uploadedDocs, { type: selectedType, fileName: file.name }]);
      setSelectedType("");
      
      // Update checklist
      await loadChecklist();
      
      toast.success("Dokument hochgeladen");
    } catch (error: any) {
      toast.error("Fehler beim Hochladen");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (uploadedDocs.length === 0) {
      toast.error("Bitte laden Sie mindestens ein Dokument hoch");
      return;
    }
    onComplete();
  };

  const getDocumentTypes = () => {
    const baseTypes = [
      { value: "id_document", label: "Ausweisdokument" },
      { value: "proof_of_address", label: "Adressnachweis" },
      { value: "other", label: "Sonstiges" },
    ];

    // GmbH, AG, UG, KG, OHG → Handelsregister
    if (["gmbh", "ag", "ug", "kg", "ohg"].includes(legalForm || "")) {
      return [
        { value: "commercial_register", label: "Handelsregisterauszug" },
        { value: "transparency_register", label: "Transparenzregister" },
        { value: "articles_of_association", label: "Gesellschaftsvertrag" },
        ...baseTypes,
      ];
    }

    // Einzelunternehmen → Kein Register
    if (legalForm === "einzelunternehmen") {
      return [
        { value: "articles_of_association", label: "Gewerbeanmeldung" },
        ...baseTypes,
      ];
    }

    // Andere (z.B. Verein) → Vereinsregister
    return [
      { value: "commercial_register", label: "Registerauszug" },
      { value: "articles_of_association", label: "Satzung/Vertrag" },
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
            {documentTypes.map((docType) => {
              const status = checklist[docType.value];
              const isUploaded = status?.uploaded || false;
              const isMarkedAvailable = status?.markedAvailable || false;
              
              return (
                <div key={docType.value} className="flex items-center gap-3 p-2">
                  {isUploaded ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : isMarkedAvailable ? (
                    <CheckCircle2 className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`text-sm ${isUploaded ? 'text-green-600 font-medium' : isMarkedAvailable ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {docType.label}
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
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Typ auswählen" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
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
            disabled={loading || uploadedDocs.length === 0}
          >
            Weiter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentsStep;