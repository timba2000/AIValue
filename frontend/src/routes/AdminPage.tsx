import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, LogOut, User, Settings, Database, Users, Building2, Workflow, AlertTriangle, Lightbulb, Check, X } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface AdminStats {
  companies: number;
  businessUnits: number;
  processes: number;
  painPoints: number;
  useCases: number;
  users: number;
}

interface UserRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: number;
  createdAt: string;
}

export default function AdminPage() {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);
  
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      setStatsLoading(true);
      fetch(`${API_BASE}/api/admin/stats`, { credentials: "include" })
        .then(res => res.ok ? res.json() : null)
        .then(data => setStats(data))
        .finally(() => setStatsLoading(false));
      
      setUsersLoading(true);
      setUsersError(null);
      fetch(`${API_BASE}/api/admin/users`, { credentials: "include" })
        .then(res => {
          if (!res.ok) throw new Error("Failed to load users");
          return res.json();
        })
        .then(data => setUsersList(data))
        .catch(err => setUsersError(err.message || "Failed to load users"))
        .finally(() => setUsersLoading(false));
    }
  }, [isAuthenticated, isAdmin]);

  const toggleAdmin = async (userId: string, currentIsAdmin: number) => {
    setUpdatingUserId(userId);
    setUpdateError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isAdmin: currentIsAdmin === 0 })
      });
      if (res.ok) {
        setUsersList(prev => prev.map(u => 
          u.id === userId ? { ...u, isAdmin: currentIsAdmin === 0 ? 1 : 0 } : u
        ));
      } else {
        setUpdateError("Failed to update admin status. Please try again.");
      }
    } catch {
      setUpdateError("Failed to update admin status. Please try again.");
    } finally {
      setUpdatingUserId(null);
    }
  };

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
          <Button onClick={() => window.location.href = "/login"}>
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
            <Button variant="outline" onClick={async () => {
                await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
                window.location.href = "/login";
              }}>
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
              onClick={async () => {
                await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
                window.location.href = "/login";
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <h2 className="text-lg font-semibold text-foreground mb-4">System Overview</h2>
        {statsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : stats ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Companies</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.companies}</p>
            </div>
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-indigo-500" />
                <span className="text-sm text-muted-foreground">Business Units</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.businessUnits}</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Workflow className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Processes</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.processes}</p>
            </div>
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Pain Points</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.painPoints}</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Solutions</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.useCases}</p>
            </div>
            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-cyan-500" />
                <span className="text-sm text-muted-foreground">Users</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.users}</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Unable to load statistics.</p>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">User Management</h2>
            <p className="text-sm text-muted-foreground">Manage user access and admin privileges</p>
          </div>
        </div>
        
        {updateError && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {updateError}
          </div>
        )}
        
        {usersLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : usersError ? (
          <div className="text-center py-4">
            <p className="text-destructive mb-2">{usersError}</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setUsersLoading(true);
                setUsersError(null);
                fetch(`${API_BASE}/api/admin/users`, { credentials: "include" })
                  .then(res => {
                    if (!res.ok) throw new Error("Failed to load users");
                    return res.json();
                  })
                  .then(data => setUsersList(data))
                  .catch(err => setUsersError(err.message || "Failed to load users"))
                  .finally(() => setUsersLoading(false));
              }}
            >
              Retry
            </Button>
          </div>
        ) : usersList.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Joined</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Admin</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground">{u.email}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground">
                        {u.firstName || u.lastName ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "-"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleAdmin(u.id, u.isAdmin)}
                        disabled={updatingUserId === u.id || u.id === user?.id}
                        className={`inline-flex items-center justify-center w-16 h-8 rounded-full transition-colors ${
                          u.isAdmin === 1
                            ? "bg-green-500/20 text-green-600 hover:bg-green-500/30"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        } ${updatingUserId === u.id ? "opacity-50 cursor-wait" : ""} ${
                          u.id === user?.id ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        title={u.id === user?.id ? "You cannot change your own admin status" : ""}
                      >
                        {updatingUserId === u.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : u.isAdmin === 1 ? (
                          <><Check className="h-4 w-4 mr-1" />Yes</>
                        ) : (
                          <><X className="h-4 w-4 mr-1" />No</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
          <Button onClick={() => window.location.href = "/admin/processes-upload"}>
            Manage Processes
          </Button>
          <Button onClick={() => window.location.href = "/admin/pain-points-upload"}>
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
