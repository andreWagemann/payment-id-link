import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Copy, Plus, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";

type Person = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  email: string;
};

type BeneficialOwner = Person & {
  ownership_percentage: string;
};

const NewCustomer = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
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
  const [pricing, setPricing] = useState({
    has_mobile_terminal: false,
    has_stationary_terminal: false,
    mobile_monthly_rent: "",
    mobile_setup_fee: "",
    mobile_shipping_fee: "",
    stationary_monthly_rent: "",
    stationary_setup_fee: "",
    stationary_shipping_fee: "",
    transaction_fee: "",
    girocard_fee_percent: "",
    credit_card_fee_percent: "",
  });

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

      // Speichere optional vorerfasste Personen (auch unvollständige Daten)
      if (authorizedPersons.length > 0) {
        const authPersonsData = authorizedPersons
          .filter((p) => p.first_name || p.last_name || p.email) // Speichern wenn mind. ein Feld ausgefüllt
          .map((p) => ({ customer_id: customer.id, ...p }));

        if (authPersonsData.length > 0) {
          await supabase.from("authorized_persons").insert(authPersonsData);
        }
      }

      if (beneficialOwners.length > 0) {
        const beneficialOwnersData = beneficialOwners
          .filter((p) => p.first_name || p.last_name || p.ownership_percentage) // Speichern wenn mind. ein Feld ausgefüllt
          .map((p) => ({
            customer_id: customer.id,
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

      // Speichere Dokument-Checkliste
      if (availableDocuments.length > 0) {
        const checklistData = availableDocuments.map(docType => ({
          customer_id: customer.id,
          document_type: docType as "commercial_register" | "transparency_register" | "articles_of_association" | "id_document" | "proof_of_address" | "other",
          marked_as_available: true,
        }));
        await supabase.from("document_checklist").insert(checklistData);
      }

      // Speichere Pricing (nur wenn mindestens ein Terminal gewählt wurde)
      if (pricing.has_mobile_terminal || pricing.has_stationary_terminal) {
        const pricingData = {
          customer_id: customer.id,
          has_mobile_terminal: pricing.has_mobile_terminal,
          has_stationary_terminal: pricing.has_stationary_terminal,
          mobile_monthly_rent: pricing.mobile_monthly_rent ? parseFloat(pricing.mobile_monthly_rent) : null,
          mobile_setup_fee: pricing.mobile_setup_fee ? parseFloat(pricing.mobile_setup_fee) : null,
          mobile_shipping_fee: pricing.mobile_shipping_fee ? parseFloat(pricing.mobile_shipping_fee) : null,
          stationary_monthly_rent: pricing.stationary_monthly_rent ? parseFloat(pricing.stationary_monthly_rent) : null,
          stationary_setup_fee: pricing.stationary_setup_fee ? parseFloat(pricing.stationary_setup_fee) : null,
          stationary_shipping_fee: pricing.stationary_shipping_fee ? parseFloat(pricing.stationary_shipping_fee) : null,
          transaction_fee: pricing.transaction_fee ? parseFloat(pricing.transaction_fee) : null,
          girocard_fee_percent: pricing.girocard_fee_percent ? parseFloat(pricing.girocard_fee_percent) : null,
          credit_card_fee_percent: pricing.credit_card_fee_percent ? parseFloat(pricing.credit_card_fee_percent) : null,
        };
        await supabase.from("customer_pricing").insert([pricingData]);
      }

      const link = `${window.location.origin}/onboarding/${token}`;
      setMagicLink(link);
      toast.success("Kunde erfolgreich angelegt!");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Anlegen des Kunden");
    } finally {
      setLoading(false);
    }
  };

  const addAuthorizedPerson = () => {
    setAuthorizedPersons([
      ...authorizedPersons,
      { first_name: "", last_name: "", date_of_birth: "", nationality: "DE", email: "" },
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
        ownership_percentage: "",
      },
    ]);
  };

  const removeBeneficialOwner = (index: number) => {
    setBeneficialOwners(beneficialOwners.filter((_, i) => i !== index));
  };

  if (magicLink) {
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
            <CardTitle>Neuen Kunden anlegen</CardTitle>
            <CardDescription>
              Erfassen Sie die Basisangaben und optional bereits bekannte Personen
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
                  <h3 className="font-medium">Terminaltyp</h3>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="mobile-terminal"
                        checked={pricing.has_mobile_terminal}
                        onCheckedChange={(checked) => 
                          setPricing({ ...pricing, has_mobile_terminal: !!checked })
                        }
                      />
                      <label htmlFor="mobile-terminal" className="text-sm font-medium cursor-pointer">
                        Mobiles Terminal
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="stationary-terminal"
                        checked={pricing.has_stationary_terminal}
                        onCheckedChange={(checked) => 
                          setPricing({ ...pricing, has_stationary_terminal: !!checked })
                        }
                      />
                      <label htmlFor="stationary-terminal" className="text-sm font-medium cursor-pointer">
                        Stationäres Terminal
                      </label>
                    </div>
                  </div>
                </div>

                {pricing.has_mobile_terminal && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-medium">Mobiles Terminal - Preise</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Monatsmiete (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pricing.mobile_monthly_rent}
                          onChange={(e) => setPricing({ ...pricing, mobile_monthly_rent: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Einrichtungspauschale (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pricing.mobile_setup_fee}
                          onChange={(e) => setPricing({ ...pricing, mobile_setup_fee: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Versandkosten (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pricing.mobile_shipping_fee}
                          onChange={(e) => setPricing({ ...pricing, mobile_shipping_fee: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {pricing.has_stationary_terminal && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-medium">Stationäres Terminal - Preise</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Monatsmiete (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pricing.stationary_monthly_rent}
                          onChange={(e) => setPricing({ ...pricing, stationary_monthly_rent: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Einrichtungspauschale (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pricing.stationary_setup_fee}
                          onChange={(e) => setPricing({ ...pricing, stationary_setup_fee: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Versandkosten (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pricing.stationary_shipping_fee}
                          onChange={(e) => setPricing({ ...pricing, stationary_shipping_fee: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(pricing.has_mobile_terminal || pricing.has_stationary_terminal) && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-medium">Transaktionsgebühren</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Transaktionspreis (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pricing.transaction_fee}
                          onChange={(e) => setPricing({ ...pricing, transaction_fee: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Girocard Gebühr (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pricing.girocard_fee_percent}
                          onChange={(e) => setPricing({ ...pricing, girocard_fee_percent: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Kreditkarten Gebühr (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={pricing.credit_card_fee_percent}
                          onChange={(e) => setPricing({ ...pricing, credit_card_fee_percent: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                )}
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
                  Optional: Erfassen Sie bereits bekannte vertretungsberechtigte Personen
                </p>
                {authorizedPersons.map((person, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between mb-2">
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