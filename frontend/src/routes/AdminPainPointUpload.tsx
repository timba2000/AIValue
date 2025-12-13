import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowLeft, Download } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface PreviewRow {
  rowIndex: number;
  statement: string;
  impactType: string[] | null;
  businessImpact: string | null;
  magnitude: number | null;
  frequency: number | null;
  timePerUnit: number | null;
  fteCount: number | null;
  rootCause: string | null;
  workarounds: string | null;
  dependencies: string | null;
  riskLevel: string | null;
  effortSolving: number | null;
  processName: string | null;
  processId: string | null;
  taxonomyL1Name: string | null;
  taxonomyLevel1Id: string | null;
  taxonomyL2Name: string | null;
  taxonomyLevel2Id: string | null;
  taxonomyL3Name: string | null;
  taxonomyLevel3Id: string | null;
  errors: string[];
  isValid: boolean;
}

interface PreviewData {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: PreviewRow[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

export default function AdminPainPointUpload() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/api/admin/pain-points/preview`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to parse file");
      }

      const data = await response.json();
      setPreview(data);
    } catch (err) {
      setError("Failed to parse Excel file. Please check the format.");
    } finally {
      setUploading(false);
    }
  }, [file]);

  const handleImport = useCallback(async () => {
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/api/admin/pain-points/import`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Failed to import");
      }

      const data = await response.json();
      setImportResult(data);
      setPreview(null);
    } catch (err) {
      setError("Failed to import pain points. Please try again.");
    } finally {
      setImporting(false);
    }
  }, [file]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
  }, []);

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
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Upload Pain Points</h1>
              <p className="text-sm text-muted-foreground">
                Import pain points from an Excel file
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
            <h2 className="text-lg font-semibold text-foreground">Import Complete</h2>
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
            <Button variant="outline" onClick={() => window.location.href = "/pain-points"}>
              View Pain Points
            </Button>
          </div>
        </div>
      )}

      {!importResult && (
        <>
          <div className="bg-card rounded-2xl border border-border p-6 slide-up">
            <h2 className="text-lg font-semibold text-foreground mb-4">Step 1: Select Excel File</h2>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-primary font-medium hover:underline">Click to select</span>
                <span className="text-muted-foreground"> or drag and drop</span>
              </label>
              <p className="text-sm text-muted-foreground mt-2">Excel files (.xlsx, .xls) up to 10MB</p>
              {file && (
                <div className="mt-4 p-3 bg-primary/10 rounded-lg inline-flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">{file.name}</span>
                </div>
              )}
            </div>
            {file && !preview && (
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
                <h2 className="text-lg font-semibold text-foreground">Download Existing Pain Points</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Export all pain points as an Excel file for backup or as a template
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = `${API_BASE}/api/admin/pain-points/export`}
              >
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 slide-up">
            <h2 className="text-lg font-semibold text-foreground mb-4">Expected Excel Format</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your Excel file should have the following columns. Only "Statement" is required.
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
                  <tr><td className="py-2 px-3 font-medium">Statement</td><td className="py-2 px-3 text-red-500">Yes</td><td className="py-2 px-3 text-muted-foreground">Pain point description</td></tr>
                  <tr><td className="py-2 px-3">Impact Type</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Comma-separated: time_waste, quality_issue, compliance_risk, cost_overrun, customer_impact, other</td></tr>
                  <tr><td className="py-2 px-3">Business Impact</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Description of business impact</td></tr>
                  <tr><td className="py-2 px-3">Impact (1-10)</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Magnitude score 1-10</td></tr>
                  <tr><td className="py-2 px-3">Frequency (per month)</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Occurrences per month</td></tr>
                  <tr><td className="py-2 px-3">Time Required per unit (Hrs)</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Hours per occurrence</td></tr>
                  <tr><td className="py-2 px-3"># FTE on painpoint</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Number of FTEs affected</td></tr>
                  <tr><td className="py-2 px-3">Root Cause</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Root cause analysis</td></tr>
                  <tr><td className="py-2 px-3">Current Workarounds</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Current workarounds</td></tr>
                  <tr><td className="py-2 px-3">Dependencies</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">System dependencies</td></tr>
                  <tr><td className="py-2 px-3">Risk Level</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">low, medium, high, or critical</td></tr>
                  <tr><td className="py-2 px-3">Effort in Solving (1-10)</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Effort score 1-10</td></tr>
                  <tr><td className="py-2 px-3">Process Name</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Must match existing process</td></tr>
                  <tr><td className="py-2 px-3">L1 - Category</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">People, Process, or Technology</td></tr>
                  <tr><td className="py-2 px-3">L2 - Sub-category</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Must match existing sub-category</td></tr>
                  <tr><td className="py-2 px-3">L3 - Description</td><td className="py-2 px-3">No</td><td className="py-2 px-3 text-muted-foreground">Must match existing description</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {preview && (
            <div className="bg-card rounded-2xl border border-border p-6 slide-up">
              <h2 className="text-lg font-semibold text-foreground mb-4">Step 2: Review & Import</h2>
              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{preview.totalRows}</p>
                </div>
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-muted-foreground">Valid Rows</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{preview.validRows}</p>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-muted-foreground">Invalid Rows</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{preview.invalidRows}</p>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96 overflow-y-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Row</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Status</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Statement</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Category</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Process</th>
                      <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.rows.map((row) => (
                      <tr key={row.rowIndex} className={row.isValid ? "" : "bg-red-500/5"}>
                        <td className="py-2 px-3">{row.rowIndex}</td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4" />
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                              <AlertCircle className="h-4 w-4" />
                              Invalid
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 max-w-xs truncate">{row.statement || "-"}</td>
                        <td className="py-2 px-3">{row.taxonomyL1Name || "-"}</td>
                        <td className="py-2 px-3">{row.processName || "-"}</td>
                        <td className="py-2 px-3 text-red-500 text-xs">
                          {row.errors.join(", ") || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleImport} disabled={importing || preview.validRows === 0}>
                  {importing ? "Importing..." : `Import ${preview.validRows} Pain Points`}
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
