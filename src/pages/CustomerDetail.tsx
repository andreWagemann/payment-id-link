import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Customer = {
  id: string;
  company_name: string;
  legal_form: string;
  status: string;
  country: string;
  street: string;
  postal_code: string;
  city: string;
  tax_id: string;
  vat_id: string;
  commercial_register: string;
  created_at: string;
  completed_at: string | null;
};

type AuthorizedPerson = {
  id: string;
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
};

type BeneficialOwner = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  ownership_percentage: number;
};

type Document = {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  person_id: string | null;
};

type SepaMandate = {
  id: string;
  iban: string;
  bic: string;
  bank_name: string;
  account_holder: string;
  mandate_reference: string;
  mandate_date: string;
  accepted: boolean;
  accepted_at: string | null;
};

type Signature = {
  id: string;
  signature_data: string;
  timestamp: string;
  terms_accepted: boolean;
  privacy_accepted: boolean;
};

const CustomerDetail = () => {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [authorizedPersons, setAuthorizedPersons] = useState<AuthorizedPerson[]>([]);
  const [beneficialOwners, setBeneficialOwners] = useState<BeneficialOwner[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sepaMandate, setSepaMandate] = useState<SepaMandate | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  useEffect(() => {
    checkAuth();
    loadCustomerData();
  }, [customerId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadCustomerData = async () => {
    if (!customerId) return;

    try {
      setLoading(true);

      // Load customer
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Load authorized persons
      const { data: authPersons } = await supabase
        .from("authorized_persons")
        .select("*")
        .eq("customer_id", customerId);
      setAuthorizedPersons(authPersons || []);

      // Load beneficial owners
      const { data: benOwners } = await supabase
        .from("beneficial_owners")
        .select("*")
        .eq("customer_id", customerId);
      setBeneficialOwners(benOwners || []);

      // Load documents
      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("customer_id", customerId);
      setDocuments(docs || []);

      // Load SEPA mandate
      const { data: mandate } = await supabase
        .from("sepa_mandates")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();
      setSepaMandate(mandate);

      // Load signature
      const { data: sig } = await supabase
        .from("signatures")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();
      setSignature(sig);

    } catch (error: any) {
      toast.error("Fehler beim Laden der Kundendaten");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("kyc-documents")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error("Fehler beim Download");
    }
  };

  const downloadContract = async () => {
    if (!customerId) return;
    
    try {
      setGeneratingContract(true);

      // Prüfe ob bereits ein Vertrag existiert
      const { data: existingDocs } = await supabase
        .from("documents")
        .select("*")
        .eq("customer_id", customerId)
        .eq("document_type", "other")
        .ilike("file_name", "Vertrag_%")
        .order("uploaded_at", { ascending: false })
        .limit(1);

      if (existingDocs && existingDocs.length > 0) {
        // Bestehenden Vertrag herunterladen
        const contract = existingDocs[0];
        await downloadDocument(contract.file_path, contract.file_name);
        toast.success("Vertrag heruntergeladen");
      } else {
        // Neuen Vertrag generieren
        toast.info("Vertrag wird generiert...");
        
        const { data, error } = await supabase.functions.invoke('generate-contract', {
          body: { customerId }
        });

        if (error) throw error;

        toast.success("Vertrag wurde erfolgreich erstellt");
        
        // Download the generated contract
        if (data.filePath && data.fileName) {
          await downloadDocument(data.filePath, data.fileName);
        }
        
        // Reload documents
        await loadCustomerData();
      }
    } catch (error: any) {
      console.error("Error with contract:", error);
      toast.error("Fehler beim Vertrag");
    } finally {
      setGeneratingContract(false);
    }
  };

  const regenerateContract = async () => {
    if (!customerId) return;
    
    try {
      setGeneratingContract(true);
      toast.info("Vertrag wird neu generiert...");

      const { data, error } = await supabase.functions.invoke('generate-contract', {
        body: { customerId }
      });

      if (error) throw error;

      toast.success("Vertrag wurde neu generiert");
      
      if (data.filePath && data.fileName) {
        await downloadDocument(data.filePath, data.fileName);
      }
      
      await loadCustomerData();
    } catch (error: any) {
      console.error("Error regenerating contract:", error);
      toast.error("Fehler beim Neugenerieren des Vertrags");
    } finally {
      setGeneratingContract(false);
    }
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingTemplate(true);
      toast.info("Template wird hochgeladen...");

      const { error } = await supabase.storage
        .from('kyc-documents')
        .upload('templates/contract-template.pdf', file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      toast.success("Template wurde erfolgreich hochgeladen!");
    } catch (error: any) {
      console.error("Error uploading template:", error);
      toast.error("Fehler beim Hochladen des Templates");
    } finally {
      setUploadingTemplate(false);
      // Reset input
      event.target.value = '';
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      draft: { variant: "secondary", label: "Entwurf" },
      invited: { variant: "default", label: "Eingeladen" },
      in_progress: { variant: "default", label: "In Bearbeitung" },
      completed: { variant: "outline", label: "Abgeschlossen" },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      commercial_register: "Handelsregisterauszug",
      transparency_register: "Transparenzregister",
      articles_of_association: "Gewerbeanmeldung",
      id_document: "Ausweisdokument",
      proof_of_address: "Adressnachweis",
      other: "Sonstiges",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">Lädt...</div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">Kunde nicht gefunden</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{customer.company_name}</h1>
              <p className="text-muted-foreground">
                {customer.legal_form.toUpperCase()} · Erstellt am{" "}
                {new Date(customer.created_at).toLocaleDateString("de-DE")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {customer.status === 'completed' && (
                <>
                  <Button
                    onClick={downloadContract}
                    disabled={generatingContract}
                    variant="default"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {generatingContract ? "Lädt..." : "Vertrag herunterladen"}
                  </Button>
                  
                  <Button
                    onClick={regenerateContract}
                    disabled={generatingContract}
                    variant="outline"
                    size="sm"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {generatingContract ? "Generiert..." : "Neu generieren"}
                  </Button>
                  
                  {/* Temporärer Upload Button */}
                  <div>
                    <input
                      type="file"
                      id="template-upload"
                      accept=".pdf"
                      onChange={handleTemplateUpload}
                      className="hidden"
                    />
                    <Button
                      onClick={() => document.getElementById('template-upload')?.click()}
                      disabled={uploadingTemplate}
                      variant="outline"
                      size="sm"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingTemplate ? "Lädt hoch..." : "Template hochladen"}
                    </Button>
                  </div>
                </>
              )}
              {getStatusBadge(customer.status)}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="company">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="company">Unternehmen</TabsTrigger>
            <TabsTrigger value="authorized">Vertr.ber.</TabsTrigger>
            <TabsTrigger value="beneficial">Wirtsch.Ber.</TabsTrigger>
            <TabsTrigger value="documents">Dokumente</TabsTrigger>
            <TabsTrigger value="sepa">SEPA</TabsTrigger>
            <TabsTrigger value="signature">Unterschrift</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Unternehmensdaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Firmenname</p>
                    <p>{customer.company_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rechtsform</p>
                    <p>{customer.legal_form.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Straße</p>
                    <p>{customer.street || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">PLZ / Ort</p>
                    <p>{customer.postal_code} {customer.city}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Land</p>
                    <p>{customer.country}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Steuernummer</p>
                    <p>{customer.tax_id || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">USt-IdNr.</p>
                    <p>{customer.vat_id || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Handelsregister</p>
                    <p>{customer.commercial_register || "-"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="authorized" className="space-y-4 mt-6">
            {authorizedPersons.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Keine vertretungsberechtigten Personen erfasst
                </CardContent>
              </Card>
            ) : (
              authorizedPersons.map((person, index) => (
                <Card key={person.id}>
                  <CardHeader>
                    <CardTitle>
                      {person.first_name} {person.last_name}
                    </CardTitle>
                    <CardDescription>Vertretungsberechtigte Person {index + 1}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Geburtsdatum</p>
                        <p>{person.date_of_birth ? new Date(person.date_of_birth).toLocaleDateString("de-DE") : "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Geburtsort</p>
                        <p>{person.place_of_birth || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Nationalität</p>
                        <p>{person.nationality}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">E-Mail</p>
                        <p>{person.email || "-"}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Privatadresse</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Straße</p>
                          <p>{person.private_street || "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">PLZ / Ort</p>
                          <p>{person.private_postal_code} {person.private_city}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Land</p>
                          <p>{person.private_country}</p>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Ausweisdaten</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Ausweisnummer</p>
                          <p>{person.id_document_number || "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Ausstellungsdatum</p>
                          <p>{person.id_document_issue_date ? new Date(person.id_document_issue_date).toLocaleDateString("de-DE") : "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Ausstellende Behörde</p>
                          <p>{person.id_document_issuing_authority || "-"}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="beneficial" className="space-y-4 mt-6">
            {beneficialOwners.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Keine wirtschaftlich Berechtigten erfasst
                </CardContent>
              </Card>
            ) : (
              beneficialOwners.map((owner, index) => (
                <Card key={owner.id}>
                  <CardHeader>
                    <CardTitle>
                      {owner.first_name} {owner.last_name}
                    </CardTitle>
                    <CardDescription>Wirtschaftlich Berechtigter {index + 1}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Geburtsdatum</p>
                        <p>{owner.date_of_birth ? new Date(owner.date_of_birth).toLocaleDateString("de-DE") : "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Nationalität</p>
                        <p>{owner.nationality}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Beteiligungsquote</p>
                        <p>{owner.ownership_percentage}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-6">
            {documents.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Keine Dokumente hochgeladen
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {documents.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{doc.file_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {getDocumentTypeLabel(doc.document_type)} · Hochgeladen am{" "}
                              {new Date(doc.uploaded_at).toLocaleDateString("de-DE")}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDocument(doc.file_path, doc.file_name)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sepa" className="space-y-4 mt-6">
            {!sepaMandate ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Kein SEPA-Mandat vorhanden
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>SEPA-Lastschriftmandat</CardTitle>
                  <CardDescription>
                    {sepaMandate.accepted ? (
                      <Badge variant="outline" className="mt-2">
                        Akzeptiert am {new Date(sepaMandate.accepted_at!).toLocaleDateString("de-DE")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="mt-2">Noch nicht akzeptiert</Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Kontoinhaber</p>
                      <p>{sepaMandate.account_holder}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">IBAN</p>
                      <p className="font-mono">{sepaMandate.iban}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">BIC</p>
                      <p>{sepaMandate.bic || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Bankname</p>
                      <p>{sepaMandate.bank_name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Mandatsreferenz</p>
                      <p className="font-mono">{sepaMandate.mandate_reference}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Mandatsdatum</p>
                      <p>{new Date(sepaMandate.mandate_date).toLocaleDateString("de-DE")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="signature" className="space-y-4 mt-6">
            {!signature ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Noch keine Unterschrift vorhanden
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Unterschrift</CardTitle>
                  <CardDescription>
                    Unterschrieben am {new Date(signature.timestamp).toLocaleDateString("de-DE")} um{" "}
                    {new Date(signature.timestamp).toLocaleTimeString("de-DE")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border rounded-lg p-4 bg-white">
                    <img 
                      src={signature.signature_data} 
                      alt="Unterschrift" 
                      className="max-w-full h-auto"
                      style={{ maxHeight: "200px" }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={signature.terms_accepted ? "outline" : "secondary"}>
                        {signature.terms_accepted ? "✓" : "✗"} AGB akzeptiert
                      </Badge>
                      <Badge variant={signature.privacy_accepted ? "outline" : "secondary"}>
                        {signature.privacy_accepted ? "✓" : "✗"} Datenschutz akzeptiert
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CustomerDetail;
