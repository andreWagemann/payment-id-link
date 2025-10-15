import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Copy, Plus, Trash2, Minus, CheckCircle2 } from "lucide-react";
import { nanoid } from "nanoid";
import { Separator } from "@/components/ui/separator";

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
  id_document_available?: boolean;
};

type BeneficialOwner = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  ownership_percentage: string;
};

type Product = {
  product_type: "mobile_terminal" | "stationary_terminal" | "softpos" | "ecommerce";
  quantity: number;
  monthly_rent: string;
  setup_fee: string;
  shipping_fee: string;
  transaction_fee: string;
};

const NewCustomer = () => {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const [loading, setLoading] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [formData, setFormData] = useState<{
    company_name: string;
    legal_form: "gmbh" | "ag" | "einzelunternehmen" | "ohg" | "kg" | "ug" | "andere" | "";
    country: string;
    street: string;
    postal_code: string;
    city: string;
    tax_id: string;
    vat_id: string;
    commercial_register: string;
  }>({
    company_name: "",
    legal_form: "",
    country: "DE",
    street: "",
    postal_code: "",
    city: "",
    tax_id: "",
    vat_id: "",
    commercial_register: "",
  });

  const [authorizedPersons, setAuthorizedPersons] = useState<Person[]>([]);
  const [beneficialOwners, setBeneficialOwners] = useState<BeneficialOwner[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cardFees, setCardFees] = useState({
    pos_girocard_fee_percent: "",
    pos_credit_card_fee_percent: "",
    ecommerce_girocard_fee_percent: "",
    ecommerce_credit_card_fee_percent: "",
  });

  useEffect(() => {
    if (customerId) {
      setIsEditMode(true);
      loadCustomerData();
    }
  }, [customerId]);

  const loadCustomerData = async () => {
    if (!customerId) return;

    try {
      setLoading(true);

      // Load customer basic data
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerError) throw customerError;

      setFormData({
        company_name: customer.company_name || "",
        legal_form: customer.legal_form || "",
        country: customer.country || "DE",
        street: customer.street || "",
        postal_code: customer.postal_code || "",
        city: customer.city || "",
        tax_id: customer.tax_id || "",
        vat_id: customer.vat_id || "",
        commercial_register: customer.commercial_register || "",
      });

      setMagicLink(`${window.location.origin}/onboarding/${customer.magic_link_token}`);

      // Load authorized persons with document availability check
      const { data: authPersons } = await supabase
        .from("authorized_persons")
        .select("*")
        .eq("customer_id", customerId);

      if (authPersons && authPersons.length > 0) {
        const personsWithAvailability = await Promise.all(
          authPersons.map(async (p) => {
            const { data: checklistItem } = await supabase
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
              id_document_available: checklistItem?.marked_as_available || false,
            };
          })
        );
        setAuthorizedPersons(personsWithAvailability);
      }

      // Load beneficial owners
      const { data: benOwners } = await supabase
        .from("beneficial_owners")
        .select("*")
        .eq("customer_id", customerId);

      if (benOwners && benOwners.length > 0) {
        setBeneficialOwners(benOwners.map(p => ({
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          date_of_birth: p.date_of_birth || "",
          nationality: p.nationality || "DE",
          ownership_percentage: p.ownership_percentage?.toString() || "",
        })));
      }

      // Load products
      const { data: productsData } = await supabase
        .from("customer_products")
        .select("*")
        .eq("customer_id", customerId);

      if (productsData && productsData.length > 0) {
        setProducts(productsData.map(p => ({
          product_type: p.product_type,
          quantity: p.quantity,
          monthly_rent: p.monthly_rent?.toString() || "",
          setup_fee: p.setup_fee?.toString() || "",
          shipping_fee: p.shipping_fee?.toString() || "",
          transaction_fee: p.transaction_fee?.toString() || "",
        })));
      }

      // Load card fees
      const { data: feesData } = await supabase
        .from("customer_transaction_fees")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();

      if (feesData) {
        setCardFees({
          pos_girocard_fee_percent: feesData.pos_girocard_fee_percent?.toString() || "",
          pos_credit_card_fee_percent: feesData.pos_credit_card_fee_percent?.toString() || "",
          ecommerce_girocard_fee_percent: feesData.ecommerce_girocard_fee_percent?.toString() || "",
          ecommerce_credit_card_fee_percent: feesData.ecommerce_credit_card_fee_percent?.toString() || "",
        });
      }

      // Load document checklist
      const { data: checklistData } = await supabase
        .from("document_checklist")
        .select("document_type")
        .eq("customer_id", customerId)
        .eq("marked_as_available", true);

      if (checklistData) {
        setAvailableDocuments(checklistData.map(d => d.document_type));
      }

    } catch (error: any) {
      toast.error(error.message || "Fehler beim Laden der Kundendaten");
    } finally {
      setLoading(false);
    }
  };

  const requiresCommercialRegister = () => {
    return ["gmbh", "ag", "ug", "kg", "ohg"].includes(formData.legal_form);
  };

  const getDocumentTypes = () => {
    const baseTypes = [
      { value: "other", label: "Sonstiges" },
    ];

    if (["gmbh", "ag", "ug", "kg", "ohg"].includes(formData.legal_form)) {
      return [
        { value: "commercial_register", label: "Handelsregisterauszug" },
        { value: "transparency_register", label: "Transparenzregister" },
        ...baseTypes,
      ];
    }

    if (formData.legal_form === "einzelunternehmen") {
      return [
        { value: "articles_of_association", label: "Gewerbeanmeldung" },
        ...baseTypes,
      ];
    }

    return [
      { value: "commercial_register", label: "Registerauszug" },
      ...baseTypes,
    ];
  };

  const addProduct = (type: "mobile_terminal" | "stationary_terminal" | "softpos" | "ecommerce") => {
    setProducts([...products, { product_type: type, quantity: 1, monthly_rent: "", setup_fee: "", shipping_fee: "", transaction_fee: "" }]);
  };

  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof Product, value: string | number) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
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

  const hasPOSProducts = () => {
    return products.some(p => ['mobile_terminal', 'stationary_terminal', 'softpos'].includes(p.product_type));
  };

  const hasEcommerceProducts = () => {
    return products.some(p => p.product_type === 'ecommerce');
  };

  const toggleDocumentAvailable = (docType: string) => {
    setAvailableDocuments(prev => 
      prev.includes(docType) 
        ? prev.filter(d => d !== docType)
        : [...prev, docType]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      if (!formData.legal_form) {
        throw new Error("Rechtsform muss ausgewählt werden");
      }

      let currentCustomerId = customerId;

      // If edit mode, update existing customer
      if (isEditMode && customerId) {
        const { error: updateError } = await supabase
          .from("customers")
          .update({
            company_name: formData.company_name,
            legal_form: formData.legal_form as "gmbh" | "ag" | "einzelunternehmen" | "ohg" | "kg" | "ug" | "andere",
            country: formData.country,
            street: formData.street,
            postal_code: formData.postal_code,
            city: formData.city,
            tax_id: formData.tax_id,
            vat_id: formData.vat_id,
            commercial_register: formData.commercial_register,
          })
          .eq("id", customerId);

        if (updateError) throw updateError;
      } else {
        // Create new customer
        const token = nanoid(32);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const { data: customer, error } = await supabase
          .from("customers")
          .insert([
            {
              ...formData,
              legal_form: formData.legal_form as "gmbh" | "ag" | "einzelunternehmen" | "ohg" | "kg" | "ug" | "andere",
              created_by: user.id,
              magic_link_token: token,
              magic_link_expires_at: expiresAt.toISOString(),
              status: "invited" as const,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        currentCustomerId = customer.id;
        setMagicLink(`${window.location.origin}/onboarding/${token}`);
        setShowMagicLink(true);
      }

      // Delete and re-insert authorized persons
      await supabase.from("authorized_persons").delete().eq("customer_id", currentCustomerId!);

      // Save authorized persons
      if (authorizedPersons.length > 0) {
        const personsWithChecklist: Array<{
          personData: any;
          hasIdDocument: boolean;
        }> = authorizedPersons
          .filter((p) => p.first_name || p.last_name || p.email)
          .map((p) => ({
            personData: {
              customer_id: currentCustomerId!, 
              first_name: p.first_name,
              last_name: p.last_name,
              date_of_birth: p.date_of_birth || null,
              place_of_birth: p.place_of_birth || null,
              nationality: p.nationality || "DE",
              email: p.email || null,
              private_street: p.private_street || null,
              private_postal_code: p.private_postal_code || null,
              private_city: p.private_city || null,
              private_country: p.private_country || "DE",
              id_document_number: p.id_document_number || null,
              id_document_issue_date: p.id_document_issue_date || null,
              id_document_issuing_authority: p.id_document_issuing_authority || null,
            },
            hasIdDocument: p.id_document_available || false,
          }));

        if (personsWithChecklist.length > 0) {
          const { data: savedPersons, error: personsError } = await supabase
            .from("authorized_persons")
            .insert(personsWithChecklist.map(p => p.personData))
            .select();

          if (personsError) throw personsError;

          // Save ID document availability markers
          if (savedPersons) {
            const idDocChecklistItems = savedPersons
              .map((savedPerson, index) => {
                if (personsWithChecklist[index].hasIdDocument) {
                  return {
                    customer_id: currentCustomerId!,
                    person_id: savedPerson.id,
                    document_type: "id_document" as const,
                    marked_as_available: true,
                  };
                }
                return null;
              })
              .filter(item => item !== null);

            if (idDocChecklistItems.length > 0) {
              await supabase.from("document_checklist").insert(idDocChecklistItems);
            }
          }
        }
      }

      if (beneficialOwners.length > 0) {
        const beneficialOwnersData = beneficialOwners
          .filter((p) => p.first_name || p.last_name || p.ownership_percentage)
          .map((p) => ({
            customer_id: currentCustomerId!,
            first_name: p.first_name || "",
            last_name: p.last_name || "",
            date_of_birth: p.date_of_birth || null,
            nationality: p.nationality || "DE",
            ownership_percentage: p.ownership_percentage ? parseFloat(p.ownership_percentage) : null,
          }));

        if (beneficialOwnersData.length > 0) {
          await supabase.from("beneficial_owners").insert(beneficialOwnersData);
        }
      }

      // Delete and re-insert document checklist
      await supabase.from("document_checklist").delete().eq("customer_id", currentCustomerId!);
      
      if (availableDocuments.length > 0) {
        const checklistData = availableDocuments.map(docType => ({
          customer_id: currentCustomerId!,
          document_type: docType as "commercial_register" | "transparency_register" | "articles_of_association" | "id_document" | "proof_of_address" | "other",
          marked_as_available: true,
        }));
        await supabase.from("document_checklist").insert(checklistData);
      }

      // Delete and re-insert products
      await supabase.from("customer_products").delete().eq("customer_id", currentCustomerId!);

      if (products.length > 0) {
        const productsData = products.map(p => ({
          customer_id: currentCustomerId!,
          product_type: p.product_type,
          quantity: p.quantity,
          monthly_rent: p.monthly_rent ? parseFloat(p.monthly_rent) : null,
          setup_fee: p.setup_fee ? parseFloat(p.setup_fee) : null,
          shipping_fee: p.shipping_fee ? parseFloat(p.shipping_fee) : null,
          transaction_fee: p.transaction_fee ? parseFloat(p.transaction_fee) : null,
        }));
        await supabase.from("customer_products").insert(productsData);
      }

      // Delete and re-insert card fees
      await supabase.from("customer_transaction_fees").delete().eq("customer_id", currentCustomerId!);

      const hasAnyFees = Object.values(cardFees).some(v => v !== "");
      if (hasAnyFees) {
        const feesData = {
          customer_id: currentCustomerId!,
          pos_girocard_fee_percent: cardFees.pos_girocard_fee_percent ? parseFloat(cardFees.pos_girocard_fee_percent) : null,
          pos_credit_card_fee_percent: cardFees.pos_credit_card_fee_percent ? parseFloat(cardFees.pos_credit_card_fee_percent) : null,
          ecommerce_girocard_fee_percent: cardFees.ecommerce_girocard_fee_percent ? parseFloat(cardFees.ecommerce_girocard_fee_percent) : null,
          ecommerce_credit_card_fee_percent: cardFees.ecommerce_credit_card_fee_percent ? parseFloat(cardFees.ecommerce_credit_card_fee_percent) : null,
        };
        await supabase.from("customer_transaction_fees").insert([feesData]);
      }

      if (isEditMode) {
        toast.success("Kunde erfolgreich aktualisiert!");
        navigate("/dashboard");
      } else {
        toast.success("Kunde erfolgreich angelegt!");
      }
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Anlegen des Kunden");
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
        id_document_available: false,
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
        ownership_percentage: "",
      },
    ]);
  };

  const removeBeneficialOwner = (index: number) => {
    setBeneficialOwners(beneficialOwners.filter((_, i) => i !== index));
  };

  if (showMagicLink && magicLink) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="container mx-auto max-w-2xl py-8">
          <Card>
            <CardHeader>
              <CardTitle>Kunde erfolgreich angelegt</CardTitle>
              <CardDescription>
                Senden Sie diesen Link an den Kunden, um das Onboarding zu starten
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg break-all">
                {magicLink}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { navigator.clipboard.writeText(magicLink); toast.success("Link kopiert!"); }} className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Link kopieren
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  Zum Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-2xl py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{isEditMode ? "Kunde bearbeiten" : "Neuen Kunden anlegen"}</CardTitle>
            <CardDescription>
              {isEditMode 
                ? "Bearbeiten Sie die Kundenangaben und optional bereits bekannte Personen"
                : "Erfassen Sie die Basisangaben und optional bereits bekannte Personen"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="company">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="company">Unternehmen</TabsTrigger>
                <TabsTrigger value="pricing">Preise</TabsTrigger>
                <TabsTrigger value="documents">Dokumente</TabsTrigger>
                <TabsTrigger value="authorized">Vertretungsber.</TabsTrigger>
                <TabsTrigger value="beneficial">Wirtsch. Ber.</TabsTrigger>
              </TabsList>

              <TabsContent value="company">
                <div className="space-y-6 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Unternehmensname *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legal_form">Rechtsform *</Label>
                    <Select
                      value={formData.legal_form}
                      onValueChange={(value) => setFormData({ ...formData, legal_form: value as any })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Rechtsform wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gmbh">GmbH</SelectItem>
                        <SelectItem value="ag">AG</SelectItem>
                        <SelectItem value="ug">UG (haftungsbeschränkt)</SelectItem>
                        <SelectItem value="einzelunternehmen">Einzelunternehmen</SelectItem>
                        <SelectItem value="ohg">OHG</SelectItem>
                        <SelectItem value="kg">KG</SelectItem>
                        <SelectItem value="andere">Andere</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="street">Straße</Label>
                      <Input
                        id="street"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">PLZ</Label>
                      <Input
                        id="postal_code"
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Stadt</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax_id">Steuernummer</Label>
                    <Input
                      id="tax_id"
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vat_id">Umsatzsteuer-Identifikationsnummer (USt-IdNr.)</Label>
                    <Input
                      id="vat_id"
                      value={formData.vat_id}
                      onChange={(e) => setFormData({ ...formData, vat_id: e.target.value })}
                      placeholder="DE123456789 (optional)"
                    />
                  </div>

                  {requiresCommercialRegister() && (
                    <div className="space-y-2">
                      <Label htmlFor="commercial_register">Handelsregisternummer</Label>
                      <Input
                        id="commercial_register"
                        value={formData.commercial_register}
                        onChange={(e) =>
                          setFormData({ ...formData, commercial_register: e.target.value })
                        }
                        placeholder="HRB 12345"
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Produkte</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addProduct("mobile_terminal")}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Mobiles Terminal
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addProduct("stationary_terminal")}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Stationäres Terminal
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addProduct("softpos")}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      SOFTPOS
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addProduct("ecommerce")}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      eCommerce
                    </Button>
                  </div>

                  {products.map((product, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{getProductLabel(product.product_type)}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProduct(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Anzahl</Label>
                            <Input
                              type="number"
                              min="1"
                              value={product.quantity}
                              onChange={(e) => updateProduct(index, "quantity", parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Monatsmiete (€)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={product.monthly_rent}
                              onChange={(e) => updateProduct(index, "monthly_rent", e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Transaktionspreis (€)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={product.transaction_fee}
                              onChange={(e) => updateProduct(index, "transaction_fee", e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Einrichtungsgebühr (€)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={product.setup_fee}
                              onChange={(e) => updateProduct(index, "setup_fee", e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Versandkosten (€)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={product.shipping_fee}
                              onChange={(e) => updateProduct(index, "shipping_fee", e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {hasPOSProducts() && (
                    <div className="p-4 border rounded-lg space-y-4 bg-blue-50/50 dark:bg-blue-950/20">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-sm">
                          POS
                        </div>
                        <h4 className="font-medium">Transaktionsgebühren - POS Terminals</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Gilt für: Mobiles Terminal, Stationäres Terminal, SOFTPOS
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Girocard Gebühr (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={cardFees.pos_girocard_fee_percent}
                            onChange={(e) => setCardFees({ ...cardFees, pos_girocard_fee_percent: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Kreditkarten Gebühr (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={cardFees.pos_credit_card_fee_percent}
                            onChange={(e) => setCardFees({ ...cardFees, pos_credit_card_fee_percent: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {hasEcommerceProducts() && (
                    <div className="p-4 border rounded-lg space-y-4 bg-purple-50/50 dark:bg-purple-950/20">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-300 font-semibold text-sm">
                          EC
                        </div>
                        <h4 className="font-medium">Transaktionsgebühren - eCommerce</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Gilt für: Online-Zahlungen
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Girocard Gebühr (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={cardFees.ecommerce_girocard_fee_percent}
                            onChange={(e) => setCardFees({ ...cardFees, ecommerce_girocard_fee_percent: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Kreditkarten Gebühr (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={cardFees.ecommerce_credit_card_fee_percent}
                            onChange={(e) => setCardFees({ ...cardFees, ecommerce_credit_card_fee_percent: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4 mt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Optional: Markieren Sie, welche Dokumente Sie bereits vorliegen haben
                </p>
                <div className="space-y-2">
                  {formData.legal_form && getDocumentTypes().map((docType) => (
                    <div key={docType.value} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                      <Checkbox
                        id={`doc-${docType.value}`}
                        checked={availableDocuments.includes(docType.value)}
                        onCheckedChange={() => toggleDocumentAvailable(docType.value)}
                      />
                      <label
                        htmlFor={`doc-${docType.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                      >
                        {docType.label}
                      </label>
                    </div>
                  ))}
                  {!formData.legal_form && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Bitte wählen Sie zunächst eine Rechtsform aus
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="authorized" className="space-y-4 mt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Optional: Erfassen Sie bereits bekannte vertretungsberechtigte Personen (GWG-Pflichtangaben)
                </p>
                {authorizedPersons.map((person, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-6 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Person {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAuthorizedPerson(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Persönliche Daten */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase">Persönliche Daten</h5>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Vorname</Label>
                          <Input
                            value={person.first_name}
                            onChange={(e) => {
                              const updated = [...authorizedPersons];
                              updated[index].first_name = e.target.value;
                              setAuthorizedPersons(updated);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nachname</Label>
                          <Input
                            value={person.last_name}
                            onChange={(e) => {
                              const updated = [...authorizedPersons];
                              updated[index].last_name = e.target.value;
                              setAuthorizedPersons(updated);
                            }}
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
                          <Label>Geburtsort</Label>
                          <Input
                            value={person.place_of_birth}
                            onChange={(e) => {
                              const updated = [...authorizedPersons];
                              updated[index].place_of_birth = e.target.value;
                              setAuthorizedPersons(updated);
                            }}
                            placeholder="z.B. Berlin"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Staatsangehörigkeit</Label>
                          <Input
                            value={person.nationality}
                            onChange={(e) => {
                              const updated = [...authorizedPersons];
                              updated[index].nationality = e.target.value.toUpperCase();
                              setAuthorizedPersons(updated);
                            }}
                            placeholder="DE"
                            maxLength={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>E-Mail (optional)</Label>
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

                    {/* Privatadresse */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase">Privatadresse</h5>
                      
                      <div className="space-y-2">
                        <Label>Straße & Hausnummer</Label>
                        <Input
                          value={person.private_street}
                          onChange={(e) => {
                            const updated = [...authorizedPersons];
                            updated[index].private_street = e.target.value;
                            setAuthorizedPersons(updated);
                          }}
                          placeholder="z.B. Musterstraße 123"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>PLZ</Label>
                          <Input
                            value={person.private_postal_code}
                            onChange={(e) => {
                              const updated = [...authorizedPersons];
                              updated[index].private_postal_code = e.target.value;
                              setAuthorizedPersons(updated);
                            }}
                            placeholder="12345"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Stadt</Label>
                          <Input
                            value={person.private_city}
                            onChange={(e) => {
                              const updated = [...authorizedPersons];
                              updated[index].private_city = e.target.value;
                              setAuthorizedPersons(updated);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Land</Label>
                          <Input
                            value={person.private_country}
                            onChange={(e) => {
                              const updated = [...authorizedPersons];
                              updated[index].private_country = e.target.value.toUpperCase();
                              setAuthorizedPersons(updated);
                            }}
                            placeholder="DE"
                            maxLength={2}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Ausweisdaten */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase">Ausweisdaten</h5>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Ausweisnummer</Label>
                          <Input
                            value={person.id_document_number}
                            onChange={(e) => {
                              const updated = [...authorizedPersons];
                              updated[index].id_document_number = e.target.value;
                              setAuthorizedPersons(updated);
                            }}
                            placeholder="z.B. T12345678"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ausstellungsdatum</Label>
                          <Input
                            type="date"
                            value={person.id_document_issue_date}
                            onChange={(e) => {
                              const updated = [...authorizedPersons];
                              updated[index].id_document_issue_date = e.target.value;
                              setAuthorizedPersons(updated);
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Ausstellende Behörde</Label>
                        <Input
                          value={person.id_document_issuing_authority}
                          onChange={(e) => {
                            const updated = [...authorizedPersons];
                            updated[index].id_document_issuing_authority = e.target.value;
                            setAuthorizedPersons(updated);
                          }}
                          placeholder="z.B. Stadt Berlin"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Ausweisdokument Verfügbarkeit */}
                    <div className="space-y-4">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase">Ausweisdokument</h5>
                      
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                        <Checkbox
                          id={`id-doc-available-${index}`}
                          checked={person.id_document_available || false}
                          onCheckedChange={(checked) => {
                            const updated = [...authorizedPersons];
                            updated[index].id_document_available = checked as boolean;
                            setAuthorizedPersons(updated);
                          }}
                        />
                        <label
                          htmlFor={`id-doc-available-${index}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                        >
                          Ausweisdokument liegt bereits vor
                        </label>
                        {person.id_document_available && (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        Markieren Sie diese Option, wenn Sie das Ausweisdokument bereits in Papierform oder digital vorliegen haben. Der Kunde muss es dann nicht erneut im Onboarding hochladen.
                      </p>
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
                  Person hinzufügen
                </Button>
              </TabsContent>

              <TabsContent value="beneficial" className="space-y-4 mt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Optional: Erfassen Sie bereits bekannte wirtschaftlich Berechtigte
                </p>
                {beneficialOwners.map((owner, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Person {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBeneficialOwner(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Vorname</Label>
                        <Input
                          value={owner.first_name}
                          onChange={(e) => {
                            const updated = [...beneficialOwners];
                            updated[index].first_name = e.target.value;
                            setBeneficialOwners(updated);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nachname</Label>
                        <Input
                          value={owner.last_name}
                          onChange={(e) => {
                            const updated = [...beneficialOwners];
                            updated[index].last_name = e.target.value;
                            setBeneficialOwners(updated);
                          }}
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
                  Person hinzufügen
                </Button>
              </TabsContent>
            </Tabs>

            <Button
              onClick={handleSubmit}
              className="w-full mt-6"
              disabled={loading}
            >
              {loading ? "Wird angelegt..." : "Kunde anlegen & Link generieren"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewCustomer;