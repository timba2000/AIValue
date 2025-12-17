import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Download,
  Upload,
  ArrowLeft,
  TrendingUp,
  Users,
  Workflow,
  AlertTriangle,
  Lightbulb,
  Clock,
  BarChart3,
  PieChart,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

interface Company {
  id: string;
  name: string;
}

interface CompanyInsights {
  summary: {
    businessUnits: number;
    processes: number;
    painPoints: number;
    solutions: number;
    totalFTE: number;
    totalProcessFTE: number;
    totalHoursWasted: number;
    avgPainPointsPerProcess: string;
  };
  charts: {
    severityBreakdown: { name: string; value: number; color: string }[];
    businessUnitBreakdown: { name: string; processes: number; painPoints: number; fte: number }[];
    processL1Breakdown: { name: string; value: number }[];
  };
}

export default function AdminBusinessPage() {
  const { isLoading: authLoading, isAuthenticated, isAdmin } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [insights, setInsights] = useState<CompanyInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (isAuthenticated) {
      fetch(`${API_BASE}/api/companies`, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          setCompanies(data);
          if (data.length > 0) {
            setSelectedCompanyId(data[0].id);
          }
        })
        .finally(() => setCompaniesLoading(false));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedCompanyId) {
      setInsightsLoading(true);
      fetch(`${API_BASE}/api/admin/business/companies/${selectedCompanyId}/insights`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => setInsights(data))
        .catch(() => setInsights(null))
        .finally(() => setInsightsLoading(false));
    }
  }, [selectedCompanyId]);

  const handleDownload = async () => {
    if (!selectedCompanyId) return;
    
    const response = await fetch(
      `${API_BASE}/api/admin/business/companies/${selectedCompanyId}/structure/download`,
      { credentials: "include" }
    );
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const company = companies.find((c) => c.id === selectedCompanyId);
      a.download = `${company?.name || "company"}_structure.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompanyId) return;

    setUploadLoading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/business/companies/${selectedCompanyId}/structure/upload`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await response.json();
      if (response.ok) {
        setUploadResult({
          success: true,
          message: `Created ${data.created?.businessUnits || 0} business units and ${data.created?.processes || 0} processes`,
        });
        fetch(`${API_BASE}/api/admin/business/companies/${selectedCompanyId}/insights`, {
          credentials: "include",
        })
          .then((res) => res.json())
          .then((data) => setInsights(data));
      } else {
        setUploadResult({ success: false, message: data.message || "Upload failed" });
      }
    } catch {
      setUploadResult({ success: false, message: "Upload failed" });
    } finally {
      setUploadLoading(false);
      e.target.value = "";
    }
  };

  if (authLoading || companiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You need admin privileges to access this page.</p>
      </div>
    );
  }

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  return (
    <section className="space-y-6 fade-in">
      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => (window.location.href = "/admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Business Management</h1>
              <p className="text-sm text-muted-foreground">Manage company structures and view insights</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="px-4 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card rounded-2xl border border-border p-6 slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Download Structure</h3>
              <p className="text-xs text-muted-foreground">Export company structure as Excel</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Download the complete structure including business units and processes for{" "}
            <span className="font-medium text-foreground">{selectedCompany?.name || "selected company"}</span>.
          </p>
          <Button onClick={handleDownload} disabled={!selectedCompanyId} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download Excel
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Upload className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Upload Structure</h3>
              <p className="text-xs text-muted-foreground">Import business units and processes</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Upload an Excel file with "Business Units" and "Processes" sheets to add new data.
          </p>
          <label className={cn(
              "flex items-center justify-center w-full px-4 py-2 rounded-xl border cursor-pointer transition-colors",
              uploadLoading || !selectedCompanyId
                ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                : "border-border bg-background hover:bg-muted text-foreground"
            )}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUpload}
              disabled={uploadLoading || !selectedCompanyId}
              className="hidden"
            />
            {uploadLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Excel
              </>
            )}
          </label>
          {uploadResult && (
            <div
              className={cn(
                "mt-3 p-3 rounded-lg text-sm",
                uploadResult.success
                  ? "bg-green-500/10 border border-green-500/20 text-green-600"
                  : "bg-red-500/10 border border-red-500/20 text-red-500"
              )}
            >
              {uploadResult.message}
            </div>
          )}
        </div>
      </div>

      {insightsLoading ? (
        <div className="bg-card rounded-2xl border border-border p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : insights ? (
        <>
          <div className="bg-card rounded-2xl border border-border p-6 slide-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Insights for {selectedCompany?.name}
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm text-muted-foreground">Business Units</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{insights.summary.businessUnits}</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Workflow className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Processes</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{insights.summary.processes}</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Pain Points</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{insights.summary.painPoints}</p>
              </div>
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Solutions</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{insights.summary.solutions}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 mt-4">
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-cyan-500" />
                  <span className="text-sm text-muted-foreground">Total FTE</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{insights.summary.totalFTE.toFixed(1)}</p>
              </div>
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-rose-500" />
                  <span className="text-sm text-muted-foreground">Hours Wasted (Annual)</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {insights.summary.totalHoursWasted.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">Avg Pain Points/Process</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {insights.summary.avgPainPointsPerProcess}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {insights.charts.severityBreakdown.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-6 slide-up">
                <div className="flex items-center gap-3 mb-4">
                  <PieChart className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Pain Points by Severity</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={insights.charts.severityBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {insights.charts.severityBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {insights.charts.processL1Breakdown.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-6 slide-up">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Pain Points by Impact Type</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={insights.charts.processL1Breakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {insights.charts.businessUnitBreakdown.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6 slide-up">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Business Unit Overview</h3>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insights.charts.businessUnitBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="processes" name="Processes" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="painPoints" name="Pain Points" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground">Select a company to view insights</p>
        </div>
      )}
    </section>
  );
}
