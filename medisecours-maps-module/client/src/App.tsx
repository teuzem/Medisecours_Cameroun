import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminSync from "./pages/AdminSync";
import AdminFacilityEnrichment from "./pages/AdminFacilityEnrichment";
import AdminFacilityRegistry from "./pages/AdminFacilityRegistry";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import PatientAccount from "./pages/PatientAccount";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/carte" component={Home} />
      <Route path="/connexion"><AuthPage mode="login" /></Route>
      <Route path="/inscription"><AuthPage mode="register" /></Route>
      <Route path="/espace-patient" component={PatientAccount} />
      <Route path="/administration" component={AdminSync} />
      <Route path="/administration/fiches" component={AdminFacilityEnrichment} />
      <Route path="/administration/registre" component={AdminFacilityRegistry} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
