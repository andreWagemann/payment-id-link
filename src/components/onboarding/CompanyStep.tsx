import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { companySchema } from "@/lib/validationSchemas";
import { z } from "zod";

type CompanyStepProps = {
  customer: any;
  onComplete: () => void;
  onBack?: () => void;
};

const CompanyStep = ({ customer, onComplete, onBack }: CompanyStepProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    street: customer.street || "",
    postal_code: customer.postal_code || "",
    city: customer.city || "",
    tax_id: customer.tax_id || "",
    vat_id: customer.vat_id || "",
    commercial_register: customer.commercial_register || "",
  });

  const requiresCommercialRegister = () => {
    return ["gmbh", "ag", "ug", "kg", "ohg"].includes(customer.legal_form);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validationResult = companySchema.safeParse(formData);
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("customers")
        .update({
          ...validationResult.data,
          status: "in_progress",
        })
        .eq("id", customer.id);

      if (error) throw error;

      toast.success("Unternehmensdaten gespeichert");
      onComplete();
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unternehmensdaten</CardTitle>
        <CardDescription>
          Bitte vervollständigen Sie die Angaben zu Ihrem Unternehmen
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street">Straße & Hausnummer *</Label>
            <Input
              id="street"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postal_code">Postleitzahl *</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Stadt *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>
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
              <Label htmlFor="commercial_register">
                {customer.legal_form === "andere" ? "Registernummer" : "Handelsregisternummer"}
              </Label>
              <Input
                id="commercial_register"
                value={formData.commercial_register}
                onChange={(e) => setFormData({ ...formData, commercial_register: e.target.value })}
                placeholder="HRB 12345"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Wird gespeichert..." : "Weiter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CompanyStep;