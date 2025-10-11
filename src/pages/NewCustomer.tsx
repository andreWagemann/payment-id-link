import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Copy } from "lucide-react";
import { nanoid } from "nanoid";

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
    commercial_register: string;
  }>({
    company_name: "",
    legal_form: "",
    country: "DE",
    street: "",
    postal_code: "",
    city: "",
    tax_id: "",
    commercial_register: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 Tage gültig

      if (!formData.legal_form) {
        throw new Error("Rechtsform muss ausgewählt werden");
      }

      const { data, error } = await supabase
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

      const link = `${window.location.origin}/onboarding/${token}`;
      setMagicLink(link);
      toast.success("Kunde erfolgreich angelegt!");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Anlegen des Kunden");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (magicLink) {
      navigator.clipboard.writeText(magicLink);
      toast.success("Link kopiert!");
    }
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
                <Button onClick={copyLink} className="flex-1">
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
              Erfassen Sie die Basisangaben des Unternehmens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commercial_register">Handelsregisternummer</Label>
                <Input
                  id="commercial_register"
                  value={formData.commercial_register}
                  onChange={(e) =>
                    setFormData({ ...formData, commercial_register: e.target.value })
                  }
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Wird angelegt..." : "Kunde anlegen & Link generieren"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewCustomer;