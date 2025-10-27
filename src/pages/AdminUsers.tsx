import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, Shield, Eye, EyeOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasAdminRole = roles?.some(r => r.role === "admin");
    
    if (!hasAdminRole) {
      toast.error("Zugriff verweigert");
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    loadUsers();
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Call edge function to get users with their emails
      const { data, error } = await supabase.functions.invoke("get-users");

      if (error) throw error;

      if (data?.users) {
        setUsers(data.users);
      }
    } catch (error: any) {
      toast.error("Fehler beim Laden der Benutzer: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      // Create user via admin function
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email, password }
      });

      if (error) throw error;

      toast.success("Vertriebler erfolgreich erstellt!");
      setEmail("");
      setPassword("");
      loadUsers();
    } catch (error: any) {
      toast.error("Fehler beim Erstellen: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Benutzerverwaltung</h1>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Neuen Vertriebler anlegen
              </CardTitle>
              <CardDescription>
                Erstellen Sie ein neues Konto für einen Vertriebsmitarbeiter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vertriebler@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Sicheres Passwort"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Teilen Sie dieses Passwort dem Vertriebler außerhalb des Systems mit.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Erstellt..." : "Vertriebler anlegen"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registrierte Benutzer</CardTitle>
              <CardDescription>
                Übersicht aller Benutzer im System
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Lädt...</p>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground">Noch keine Benutzer vorhanden</p>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{user.email}</p>
                        <div className="flex gap-1 mt-1">
                          {user.roles.map((role) => (
                            <Badge key={role} variant={role === "admin" ? "default" : "secondary"}>
                              {role === "admin" ? "Admin" : "Vertriebler"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
