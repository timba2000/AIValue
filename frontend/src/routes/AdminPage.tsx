import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, LogOut, User, Settings, Database, Users } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export default function AdminPage() {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = `${API_BASE}/api/login`;
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Admin Access Required</h1>
          <p className="text-muted-foreground">Please log in to access the admin panel.</p>
          <Button onClick={() => window.location.href = `${API_BASE}/api/login`}>
            Log In
          </Button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <Shield className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access the admin panel. 
            Please contact an administrator if you believe this is an error.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              Go Home
            </Button>
            <Button variant="outline" onClick={() => window.location.href = `${API_BASE}/api/logout`}>
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6 fade-in">
      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">
                Manage your AIValue application settings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {user?.profileImageUrl ? (
                <img 
                  src={user.profileImageUrl} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  {user?.firstName || user?.email || "Admin"}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = `${API_BASE}/api/logout`}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-card rounded-2xl border border-border p-6 slide-up hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Database className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Database</h2>
              <p className="text-sm text-muted-foreground">Manage data</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            View and manage companies, business units, processes, pain points, and solutions.
          </p>
          <Button variant="outline" className="w-full" onClick={() => window.location.href = "/dashboard"}>
            Open Dashboard
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 slide-up hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Users</h2>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            User management and access control will be available in a future update.
          </p>
          <Button variant="outline" className="w-full" disabled>
            Coming Soon
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 slide-up hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Settings className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Settings</h2>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Application settings and configuration will be available in a future update.
          </p>
          <Button variant="outline" className="w-full" disabled>
            Coming Soon
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => window.location.href = "/businesses"}>
            Manage Businesses
          </Button>
          <Button onClick={() => window.location.href = "/processes"}>
            Manage Processes
          </Button>
          <Button onClick={() => window.location.href = "/pain-points"}>
            Manage Pain Points
          </Button>
          <Button onClick={() => window.location.href = "/use-cases"}>
            Manage Solutions
          </Button>
        </div>
      </div>
    </section>
  );
}
