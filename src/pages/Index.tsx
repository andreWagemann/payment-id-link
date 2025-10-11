import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-2xl px-4">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/10 p-4 rounded-full">
            <Shield className="h-16 w-16 text-primary" />
          </div>
        </div>
        <h1 className="mb-4 text-5xl font-bold">Payment AG</h1>
        <p className="text-xl text-muted-foreground mb-8">
          KYC Onboarding Plattform für Geschäftskunden
        </p>
        <Button size="lg" onClick={() => navigate("/auth")}>
          Zum Vertrieb-Login
        </Button>
      </div>
    </div>
  );
};

export default Index;
