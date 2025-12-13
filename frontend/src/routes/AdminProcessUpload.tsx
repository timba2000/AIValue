import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowLeft, Download, Building2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Company {
  id: string;
  name: string;
}

interface BusinessUnit {
  id: string;
  companyId: string;
  parentId: string | null;
  name: string;
}

interface PreviewRow {
  rowIndex: number;
  l1Process: string | null;
  l2Process: string | null;
  l3Process: string | null;
  processName: string;
  description: string | null;
  volume: number | null;
  volumeUnit: string | null;
  fte: number | null;
  owner: string | null;
  systemsUsed: string | null;
  errors: string[];
  isValid: boolean;
  isDuplicate: boolean;
}

interface PreviewData {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: PreviewRow[];
  businessUnit: BusinessUnit;
  companyId: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

export default function AdminProcessUpload() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      setLoadingData(true);
      Promise.all([
        fetch(`${API_BASE}/api/companies`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API_BASE}/api/business-units`, { credentials: "include" }).then(r => r.json())
      ])
        .then(([companiesData, businessUnitsData]) => {
          setCompanies(companiesData);
          setBusinessUnits(businessUnitsData);
        })
        .finally(() => setLoadingData(false));
    }
  }, [isAuthenticated, isAdmin]);

  const filteredBusinessUnits = businessUnits.filter(bu => bu.companyId === selectedCompanyId);

  const getBusinessUnitHierarchy = (bu: BusinessUnit): string => {
    const parts: string[] = [bu.name];
    let current = bu;
    while (current.parentId) {
      const parent = businessUnits.find(b => b.id === current.parentId);
      if (parent) {
        parts.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
    }
    return parts.join(" > ");
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(null);
      setImportResult(null);
      setError(null);
    }
  }, []);

  const handlePreview = useCallback(async () => {
    if (!file || !selectedBusinessUnitId) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE}/api/admin/processes/preview?businessUnitId=${selectedBusinessUnitId}`,
        {
          method: "POST",
          body: formData,
          credentials: "include"
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to parse file");
      }

      const data = await response.json();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse Excel file. Please check the format.");
    } finally {
      setUploading(false);
    }
  }, [file, selectedBusinessUnitId]);

  const handleImport = useCallback(async () => {
    if (!file || !selectedBusinessUnitId) return;

    setImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE}/api/admin/processes/import?businessUnitId=${selectedBusinessUnitId}`,
        {
          method: "POST",
          body: formData,
          credentials: "include"
        }
      );

      if (!response.ok) {
        throw new Error("Failed to import");
      }

      const data = await response.json();
      setImportResult(data);
      setPreview(null);
    } catch (err) {
      setError("Failed to import processes. Please try again.");
    } finally {
      setImporting(false);
    }
  }, [file, selectedBusinessUnitId]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    window.location.href = `${API_BASE}/api/admin/processes/template`;
  }, []);

  const handleExportProcesses = useCallback(() => {
    let url = `${API_BASE}/api/admin/processes/export`;
    if (selectedBusinessUnitId) {
      url += `?businessUnitId=${selectedBusinessUnitId}`;
    }
    window.location.href = url;
  }, [selectedBusinessUnitId]);

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
              <Upload className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Process Bulk Upload</h1>
              <p className="text-sm text-muted-foreground">
                Import processes from Excel with L1, L2, L3 hierarchy
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.location.href = "/admin"}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {importResult && (
        <div className="bg-card rounded-2xl border border-border p-6 slide-up">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <h2 className="text-lg font-semibold text-foreground">Process Import Complete</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-muted-foreground">Imported</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{importResult.imported}</p>
            </div>
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <p className="text-sm text-muted-foreground">Skipped</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{importResult.skipped}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{importResult.imported + importResult.skipped}</p>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Errors:</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-500">Row {err.row}: {err.error}</p>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button onClick={handleReset}>Upload Another File</Button>
            <Button variant="outline" onClick={() => window.location.href = "/processes"}>
              View Processes
            </Button>
          </div>
        </div>
      )}

      {!importResult && (
        <>
          <div className="bg-card rounded-2xl border border-border p-6 slide-up">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="h-6 w-6 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Select Business Unit</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Select the company and business unit where processes will be imported.
            </p>
            
            {loadingData ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Company</label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => {
                      setSelectedCompanyId(e.target.value);
                      setSelectedBusinessUnitId("");
                      setPreview(null);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select a company</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Business Unit</label>
                  <select
                    value={selectedBusinessUnitId}
                    onChange={(e) => {
                      setSelectedBusinessUnitId(e.target.value);
                      setPreview(null);
                    }}
                    disabled={!selectedCompanyId}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">Select a business unit</option>
                    {filteredBusinessUnits.map(bu => (
                      <option key={bu.id} value={bu.id}>{getBusinessUnitHierarchy(bu)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 slide-up">
            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Upload Excel File</h2>
            </div>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={!selectedBusinessUnitId}
              />
              <label htmlFor="file-upload" className={`cursor-pointer ${!selectedBusinessUnitId ? "opacity-50 cursor-not-allowed" : ""}`}>
                <span className="text-primary font-medium hover:underline">Click to select</span>
                <span className="text-muted-foreground"> or drag and drop</span>
              </label>
              <p className="text-sm text-muted-foreground mt-2">Excel files (.xlsx, .xls) up to 10MB</p>
              {!selectedBusinessUnitId && (
                <p className="text-sm text-orange-500 mt-2">Please select a business unit first</p>
              )}
              {file && (
                <div className="mt-4 p-3 bg-primary/10 rounded-lg inline-flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">{file.name}</span>
                </div>
              )}
            </div>
            {file && !preview && selectedBusinessUnitId && (
              <div className="mt-4">
                <Button onClick={handlePreview} disabled={uploading}>
                  {uploading ? "Parsing..." : "Preview Data"}
                </Button>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 slide-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Download Template / Export</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Download a template or export existing processes
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <Button variant="outline" onClick={handleExportProcesses}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Processes
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 slide-up">
            <h2 className="text-lg font-semibold text-foreground mb-4">Expected Excel Format</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your Excel file should have the following columns. Use L1/L2/L3 for process hierarchy or provide a full Process Name.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Column</th>
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Required</th>
                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="py-2 px-3 font-medium">L1 Process</td><td className="py-2 px-3 text-orange-500">Yes*</td><td className="py-2 px-3 text-muted-foreground">Level 1 process category (e.g., Finance)</td></tr>
                  <tr><td className="py-2 px-3">L2 Process</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Level 2 process sub-category (e.g., Accounts Payable)</td></tr>
                  <tr><td className="py-2 px-3">L3 Process</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Level 3 process detail (e.g., Invoice Processing)</td></tr>
                  <tr><td className="py-2 px-3">Process Name</td><td className="py-2 px-3 text-orange-500">Yes*</td><td className="py-2 px-3 text-muted-foreground">Full process name (auto-generated from L1/L2/L3 if not provided)</td></tr>
                  <tr><td className="py-2 px-3">Description</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Process description</td></tr>
                  <tr><td className="py-2 px-3">Volume</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Process volume (number)</td></tr>
                  <tr><td className="py-2 px-3">Volume Unit</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Unit for volume (e.g., per month, per week)</td></tr>
                  <tr><td className="py-2 px-3">FTE</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Number of FTEs involved</td></tr>
                  <tr><td className="py-2 px-3">Owner</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Process owner name</td></tr>
                  <tr><td className="py-2 px-3">Systems Used</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Systems used in the process</td></tr>
                </tbody>
              </table>
              <p className="text-sm text-muted-foreground mt-2">* Either L1 Process or Process Name is required</p>
            </div>
          </div>

          {preview && (
            <div className="bg-card rounded-2xl border border-border p-6 slide-up">
              <h2 className="text-lg font-semibold text-foreground mb-4">Preview</h2>
              <div className="grid gap-4 sm:grid-cols-4 mb-6">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{preview.totalRows}</p>
                </div>
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-muted-foreground">Valid</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{preview.validRows}</p>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-muted-foreground">Invalid</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{preview.invalidRows}</p>
                </div>
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <p className="text-sm text-muted-foreground">Duplicates</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{preview.duplicateRows}</p>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Row</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">L1</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">L2</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">L3</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Process Name</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className={row.isValid ? "" : "bg-red-500/5"}>
                        <td className="py-2 px-3">{row.rowIndex}</td>
                        <td className="py-2 px-3">{row.l1Process || "-"}</td>
                        <td className="py-2 px-3">{row.l2Process || "-"}</td>
                        <td className="py-2 px-3">{row.l3Process || "-"}</td>
                        <td className="py-2 px-3 font-medium">{row.processName}</td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="text-green-600">Valid</span>
                          ) : (
                            <span className="text-red-500">{row.errors.join(", ")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 mt-6">
                <Button 
                  onClick={handleImport} 
                  disabled={importing || preview.validRows === 0}
                >
                  {importing ? "Importing..." : `Import ${preview.validRows} Process${preview.validRows !== 1 ? "es" : ""}`}
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
