import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, History, Search, ChevronLeft, ChevronRight, RefreshCw, Eye } from "lucide-react";
import { Link } from "@/lib/wouter";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface AuditLog {
  id: string;
  userId: string | null;
  userName: string | null;
  entityType: string;
  entityId: string;
  entityName: string | null;
  action: string;
  changes: { field: string; oldValue: unknown; newValue: unknown }[] | null;
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditSummary {
  entityTypes: { entityType: string; count: number }[];
  actions: { action: string; count: number }[];
  recentActivityCount: number;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function AdminAuditPage() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const limit = 25;

  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, entityTypeFilter, actionFilter]);

  const fetchSummary = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/admin/audit-logs/summary`, {
        withCredentials: true
      });
      setSummary(response.data);
    } catch (err) {
      console.error("Failed to fetch audit summary:", err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit)
      });
      if (entityTypeFilter) params.append("entityType", entityTypeFilter);
      if (actionFilter) params.append("action", actionFilter);

      const response = await axios.get(`${API_BASE}/api/admin/audit-logs?${params}`, {
        withCredentials: true
      });
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchSummary();
    fetchLogs();
  };

  const totalPages = Math.ceil(total / limit);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin access to view this page.</p>
          <Link href="/dashboard">
            <Button className="mt-4">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10">
              <History className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
              <p className="text-sm text-muted-foreground">Track all changes made to data</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-auto gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Last 24 Hours</p>
              <p className="text-2xl font-bold text-foreground">{summary.recentActivityCount}</p>
            </div>
            {summary.actions.map(a => (
              <div key={a.action} className="bg-card rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground capitalize">{a.action}s</p>
                <p className="text-2xl font-bold text-foreground">{a.count}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <select
              value={entityTypeFilter}
              onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            >
              <option value="">All Entity Types</option>
              <option value="pain_point">Pain Points</option>
              <option value="solution">Solutions</option>
              <option value="link">Pain Point Links</option>
              <option value="company">Companies</option>
              <option value="business_unit">Business Units</option>
              <option value="process">Processes</option>
            </select>

            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>

            <span className="text-sm text-muted-foreground ml-auto">
              {total} total records
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">When</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Changes</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {log.userName || "System"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.action === 'create' ? 'bg-green-500/10 text-green-500' :
                          log.action === 'update' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground capitalize">
                        {log.entityType.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate" title={log.entityName || log.entityId}>
                        {log.entityName || log.entityId.slice(0, 8) + "..."}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {log.changes ? `${log.changes.length} field(s)` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {selectedLog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl border border-border p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Audit Log Details</h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                  Close
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Timestamp</p>
                    <p className="text-sm text-foreground">{formatDate(selectedLog.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">User</p>
                    <p className="text-sm text-foreground">{selectedLog.userName || "System"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Action</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedLog.action === 'create' ? 'bg-green-500/10 text-green-500' :
                      selectedLog.action === 'update' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Entity Type</p>
                    <p className="text-sm text-foreground capitalize">{selectedLog.entityType.replace('_', ' ')}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Entity Name</p>
                  <p className="text-sm text-foreground">{selectedLog.entityName || "-"}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Entity ID</p>
                  <p className="text-sm text-foreground font-mono">{selectedLog.entityId}</p>
                </div>

                {selectedLog.changes && selectedLog.changes.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-2">Changes Made</p>
                    <div className="space-y-2">
                      {selectedLog.changes.map((change, idx) => (
                        <div key={idx} className="bg-accent/30 rounded-lg p-3">
                          <p className="text-xs font-medium text-foreground mb-1">{change.field}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-red-500">Old: </span>
                              <span className="text-muted-foreground">{formatValue(change.oldValue)}</span>
                            </div>
                            <div>
                              <span className="text-green-500">New: </span>
                              <span className="text-muted-foreground">{formatValue(change.newValue)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLog.ipAddress && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">IP Address</p>
                    <p className="text-sm text-foreground font-mono">{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
