import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Plus, Copy, ExternalLink, Edit, Eye, Trash2, FileCheck, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Customer = {
  id: string;
  company_name: string;
  legal_form: string;
  status: string;
  created_at: string;
  magic_link_token: string | null;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuth();
    loadCustomers();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    setIsAdmin(roles?.some(r => r.role === "admin") || false);
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast.error("Fehler beim Laden der Kunden");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const copyMagicLink = (token: string) => {
    const link = `${window.location.origin}/onboarding/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link kopiert!");
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

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;

    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerToDelete.id);

      if (error) throw error;

      toast.success("Kunde erfolgreich gelöscht");
      setCustomers(customers.filter(c => c.id !== customerToDelete.id));
    } catch (error: any) {
      toast.error("Fehler beim Löschen des Kunden");
    } finally {
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Payment AG – KYC Dashboard</h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/admin/users")}>
                <Shield className="h-4 w-4 mr-2" />
                Benutzerverwaltung
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/completed")}>
              <FileCheck className="h-4 w-4 mr-2" />
              Abgeschlossene Onboardings
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold">Onboardings</h2>
            <p className="text-muted-foreground mt-1">Verwalten Sie Ihre Kundenonboardings</p>
          </div>
          <Button onClick={() => navigate("/dashboard/new-customer")}>
            <Plus className="h-4 w-4 mr-2" />
            Neuer Kunde
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">Lädt...</div>
        ) : customers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Noch keine Kunden angelegt</p>
              <Button onClick={() => navigate("/dashboard/new-customer")}>
                <Plus className="h-4 w-4 mr-2" />
                Ersten Kunden anlegen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {customers.map((customer) => (
              <Card key={customer.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{customer.company_name}</CardTitle>
                      <CardDescription className="mt-1">
                        {customer.legal_form.toUpperCase()} · Erstellt am{" "}
                        {new Date(customer.created_at).toLocaleDateString("de-DE")}
                      </CardDescription>
                    </div>
                    {getStatusBadge(customer.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {customer.status === "completed" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/dashboard/customer/${customer.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details ansehen
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/dashboard/edit-customer/${customer.id}`)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </Button>
                    {customer.magic_link_token && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyMagicLink(customer.magic_link_token!)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Link kopieren
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(`/onboarding/${customer.magic_link_token}`, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Link öffnen
                        </Button>
                      </>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(customer)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Löschen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunde löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie "{customerToDelete?.company_name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;