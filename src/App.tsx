import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminUsers from "./pages/AdminUsers";
import NewCustomer from "./pages/NewCustomer";
import CustomerDetail from "./pages/CustomerDetail";
import CompletedOnboardings from "./pages/CompletedOnboardings";
import Onboarding from "./pages/Onboarding";
import PDFEditor from "./pages/PDFEditor";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/admin/users" element={<AdminUsers />} />
          <Route path="/dashboard/new-customer" element={<NewCustomer />} />
          <Route path="/dashboard/edit-customer/:customerId" element={<NewCustomer />} />
          <Route path="/dashboard/customer/:customerId" element={<CustomerDetail />} />
          <Route path="/dashboard/completed" element={<CompletedOnboardings />} />
          <Route path="/onboarding/:token" element={<Onboarding />} />
          <Route path="/pdf-editor" element={<PDFEditor />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
