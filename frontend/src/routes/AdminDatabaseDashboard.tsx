import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, Database, ArrowLeft, Building2, Workflow, AlertTriangle, Lightbulb, Tag, Trash2, AlertCircle, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface AdminStats {
  companies: number;
  businessUnits: number;
  processes: number;
  painPoints: number;
  useCases: number;
  users: number;
  taxonomy: number;
}

interface DeleteConfirmation {
  type: "companies" | "taxonomy" | "processes" | "pain-points" | "use-cases" | "all" | null;
  label: string;
  description: string;
}

export default function AdminDatabaseDashboard() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmation>({ type: null, label: "", description: "" });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchStats();
    }
  }, [isAuthenticated, isAdmin, fetchStats]);

  const handleDelete = async () => {
    if (!deleteConfirm.type) return;
    if (deleteConfirm.type === "all" && confirmText !== "DELETE ALL") {
      setDeleteError("Please type DELETE ALL to confirm");
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/delete/${deleteConfirm.type}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        setDeleteSuccess(data.message || "Deleted successfully");
        setDeleteConfirm({ type: null, label: "", description: "" });
        setConfirmText("");
        await fetchStats();
      } else {
        const data = await res.json();
        setDeleteError(data.message || "Failed to delete");
      }
    } catch {
      setDeleteError("Failed to delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteConfirm = (type: DeleteConfirmation["type"], label: string, description: string) => {
    setDeleteConfirm({ type, label, description });
    setDeleteError(null);
    setDeleteSuccess(null);
    setConfirmText("");
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

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">Admin access required.</p>
          <Button onClick={() => window.location.href = "/admin"}>
            Go to Admin
          </Button>
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
              <Database className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Database Management</h1>
              <p className="text-sm text-muted-foreground">
                View statistics and manage data
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.location.href = "/admin"}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </div>

      {deleteSuccess && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-600 dark:text-green-400">{deleteSuccess}</p>
          <button 
            onClick={() => setDeleteSuccess(null)} 
            className="ml-auto text-green-500 hover:text-green-600"
          >
            &times;
          </button>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <h2 className="text-lg font-semibold text-foreground mb-4">Database Statistics</h2>
        {statsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : stats ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Companies</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.companies}</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.businessUnits} business units</p>
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
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4 text-indigo-500" />
                <span className="text-sm text-muted-foreground">Taxonomy</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.taxonomy}</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Unable to load statistics.</p>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Delete Data</h2>
            <p className="text-sm text-muted-foreground">Permanently remove data from the database</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="p-4 rounded-xl border border-border bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-foreground">Companies</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Delete all companies, business units, and associated processes.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-red-500 border-red-500/20 hover:bg-red-500/10"
              onClick={() => openDeleteConfirm("companies", "All Companies", "This will permanently delete all companies, their business units, and all associated processes. Pain points linked to these processes will be unlinked.")}
              disabled={stats?.companies === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Companies
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-border bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-indigo-500" />
              <span className="font-medium text-foreground">Taxonomy</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Delete all taxonomy categories (L1, L2, L3).
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-red-500 border-red-500/20 hover:bg-red-500/10"
              onClick={() => openDeleteConfirm("taxonomy", "All Taxonomy", "This will permanently delete all taxonomy categories. Pain points will have their taxonomy references cleared.")}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Taxonomy
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-border bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <Workflow className="h-4 w-4 text-purple-500" />
              <span className="font-medium text-foreground">Processes</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Delete all processes and their links to pain points.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-red-500 border-red-500/20 hover:bg-red-500/10"
              onClick={() => openDeleteConfirm("processes", "All Processes", "This will permanently delete all processes and their links to pain points and solutions.")}
              disabled={stats?.processes === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Processes
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-border bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="font-medium text-foreground">Pain Points</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Delete all pain points and their solution links.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-red-500 border-red-500/20 hover:bg-red-500/10"
              onClick={() => openDeleteConfirm("pain-points", "All Pain Points", "This will permanently delete all pain points and their links to solutions.")}
              disabled={stats?.painPoints === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Pain Points
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-border bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-green-500" />
              <span className="font-medium text-foreground">Solutions</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Delete all solutions (use cases).
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-red-500 border-red-500/20 hover:bg-red-500/10"
              onClick={() => openDeleteConfirm("use-cases", "All Solutions", "This will permanently delete all solutions and their links to pain points.")}
              disabled={stats?.useCases === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Solutions
            </Button>
          </div>

          <div className="p-4 rounded-xl border-2 border-red-500/30 bg-red-500/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="font-medium text-red-600 dark:text-red-400">Delete All Data</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete ALL data from the database.
            </p>
            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full"
              onClick={() => openDeleteConfirm("all", "ALL DATA", "This will permanently delete ALL data including companies, business units, processes, pain points, solutions, and taxonomy. This action cannot be undone. Users will not be deleted.")}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Everything
            </Button>
          </div>
        </div>
      </div>

      {deleteConfirm.type && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Confirm Deletion</h3>
                <p className="text-sm text-muted-foreground">Delete {deleteConfirm.label}</p>
              </div>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-600 dark:text-red-400">
                {deleteConfirm.description}
              </p>
            </div>

            {deleteConfirm.type === "all" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Type <span className="font-mono bg-muted px-1 rounded">DELETE ALL</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  placeholder="DELETE ALL"
                />
              </div>
            )}

            {deleteError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-500">{deleteError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setDeleteConfirm({ type: null, label: "", description: "" });
                  setConfirmText("");
                  setDeleteError(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1"
                onClick={handleDelete}
                disabled={deleting || (deleteConfirm.type === "all" && confirmText !== "DELETE ALL")}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
