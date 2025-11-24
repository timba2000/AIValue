import { useEffect, useState } from "react";
import { Route, Switch, useLocation } from "wouter";

import { MobileNav } from "@/components/navigation/MobileNav";
import { Sidebar } from "@/components/navigation/Sidebar";
import OpportunitiesDashboard from "@/routes/OpportunitiesDashboard";
import PainPointList from "@/routes/PainPointList";
import ProcessList from "@/routes/ProcessList";
import UseCaseList from "@/routes/UseCaseList";
import BusinessesPage from "@/pages/BusinessesPage";

function LoginPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Login</h1>
      <p className="text-muted-foreground">Access is restricted to authenticated users.</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">The page you requested could not be located.</p>
    </div>
  );
}

function App() {
  const [location] = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const shouldShowSidebar = location !== "/login";

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {shouldShowSidebar && isMobileNavOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden
        />
      )}

      {shouldShowSidebar && (
        <>
          <Sidebar isMobileOpen={isMobileNavOpen} onNavigate={() => setIsMobileNavOpen(false)} />
          <MobileNav isOpen={isMobileNavOpen} onToggle={() => setIsMobileNavOpen((open) => !open)} />
        </>
      )}

      <main className={`flex-1 ${shouldShowSidebar ? "pt-24 md:pt-0 md:pl-64" : ""}`}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Switch>
            <Route path="/" component={OpportunitiesDashboard} />
            <Route path="/dashboard" component={OpportunitiesDashboard} />
            <Route path="/business" component={BusinessesPage} />
            <Route path="/businesses" component={BusinessesPage} />
            <Route path="/processes" component={ProcessList} />
            <Route path="/pain-points" component={PainPointList} />
            <Route path="/use-cases" component={UseCaseList} />
            <Route path="/login" component={LoginPage} />
            <Route component={NotFoundPage} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

export default App;
