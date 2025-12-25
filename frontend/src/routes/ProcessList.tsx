import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Layers, Link2, Lightbulb, Users, AlertTriangle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterByContext } from "@/components/FilterByContext";
import { useFilterStore } from "../stores/filterStore";
import { useCompanies, useBusinessUnits } from "../hooks/useApiData";
import type { ProcessOptionsResponse, ProcessPayload, ProcessRecord, PainPointOption, UseCaseOption } from "@/types/process";

// Helper to parse L1/L2/L3 from process name
function parseProcessHierarchy(name: string): { l1: string; l2: string; l3: string } {
  let nameParts: string[] = [];
  if (name.includes(" > ")) {
    nameParts = name.split(" > ");
  } else if (name.includes(" - ")) {
    nameParts = name.split(" - ");
  } else if (name.includes("/")) {
    nameParts = name.split("/");
  }
  return {
    l1: nameParts[0]?.trim() || "-",
    l2: nameParts[1]?.trim() || "-",
    l3: nameParts[2]?.trim() || "-"
  };
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// Nested hierarchy types for process grouping
type ProcessWithHierarchy = ProcessRecord & { l1: string; l2: string; l3: string };
type L3Group = { processes: ProcessWithHierarchy[] };
type L2Group = { l3Groups: Map<string, L3Group>; directProcesses: ProcessWithHierarchy[] };
type L1Group = { l2Groups: Map<string, L2Group>; directProcesses: ProcessWithHierarchy[] };

type FormState = {
  name: string;
  description: string;
  volume: string;
  volumeUnit: string;
  fte: string;
  owner: string;
  painPointIds: string[];
  useCaseIds: string[];
};

const emptyForm: FormState = {
  name: "",
  description: "",
  volume: "",
  volumeUnit: "",
  fte: "",
  owner: "",
  painPointIds: [],
  useCaseIds: []
};

export default function ProcessList() {
  const {
    selectedCompanyId,
    selectedBusinessUnitId: selectedUnitId,
    selectedL1Process,
    selectedL2Process,
  } = useFilterStore();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProcessRecord | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [painPointSearch, setPainPointSearch] = useState("");
  const [solutionSearch, setSolutionSearch] = useState("");
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());
  const [expandedL2, setExpandedL2] = useState<Set<string>>(new Set());

  const { data: companies = [] } = useCompanies();
  const { data: businessUnits = [] } = useBusinessUnits(selectedCompanyId || undefined);

  const { data: processes = [], isLoading: loading, refetch: refetchProcesses, error: processesError } = useQuery<ProcessRecord[]>({
    queryKey: ["processes", selectedCompanyId, selectedUnitId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedUnitId) {
        params.businessUnitId = selectedUnitId;
      } else if (selectedCompanyId) {
        params.companyId = selectedCompanyId;
      }
      const response = await axios.get<ProcessRecord[]>(`${API_BASE}/api/processes`, { params });
      return response.data;
    }
  });

  const { data: options = { painPoints: [], useCases: [] }, error: optionsError } = useQuery<ProcessOptionsResponse>({
    queryKey: ["processOptions"],
    queryFn: async () => {
      const response = await axios.get<ProcessOptionsResponse>(`${API_BASE}/api/processes/options`);
      return response.data;
    }
  });

  useEffect(() => {
    if (processesError) {
      setError("Failed to load processes");
    } else if (optionsError) {
      setError("Failed to load linking options");
    }
  }, [processesError, optionsError]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const selectedUnit = useMemo(
    () => businessUnits.find((unit) => unit.id === selectedUnitId) ?? null,
    [businessUnits, selectedUnitId]
  );

  const { selectedProcessId } = useFilterStore();
  
  const filteredProcesses = useMemo(() => {
    let filtered = processes;
    
    if (selectedProcessId) {
      return processes.filter((process) => process.id === selectedProcessId);
    }
    
    if (selectedL1Process) {
      filtered = filtered.filter((process) => {
        const { l1 } = parseProcessHierarchy(process.name);
        return l1 === selectedL1Process;
      });
    }
    
    if (selectedL2Process) {
      filtered = filtered.filter((process) => {
        const { l2 } = parseProcessHierarchy(process.name);
        return l2 === selectedL2Process;
      });
    }
    
    if (search.trim()) {
      filtered = filtered.filter((process) => process.name.toLowerCase().includes(search.toLowerCase()));
    }
    
    return filtered;
  }, [processes, search, selectedL1Process, selectedL2Process, selectedProcessId]);

  const processStats = useMemo(() => {
    const totalProcesses = processes.length;
    const withPainPoints = processes.filter(p => p.painPointCount > 0).length;
    const withUseCases = processes.filter(p => p.useCaseCount > 0).length;
    const withoutLinks = processes.filter(p => p.painPointCount === 0 && p.useCaseCount === 0).length;
    const totalFTE = processes.reduce((sum, p) => sum + (p.fte || 0), 0);
    const totalPainPointLinks = processes.reduce((sum, p) => sum + p.painPointCount, 0);
    const totalUseCaseLinks = processes.reduce((sum, p) => sum + p.useCaseCount, 0);
    
    const l1Breakdown: Record<string, number> = {};
    for (const process of processes) {
      const l1 = parseProcessHierarchy(process.name).l1;
      l1Breakdown[l1] = (l1Breakdown[l1] || 0) + 1;
    }
    
    const allCategories = Object.entries(l1Breakdown).sort((a, b) => b[1] - a[1]);
    const totalCategories = allCategories.length;
    
    return {
      totalProcesses,
      withPainPoints,
      withUseCases,
      withoutLinks,
      totalFTE,
      totalPainPointLinks,
      totalUseCaseLinks,
      totalCategories,
      l1Breakdown: allCategories.slice(0, 5)
    };
  }, [processes]);

  const groupedProcesses = useMemo(() => {
    const groups: Map<string, L1Group> = new Map();
    
    for (const process of filteredProcesses) {
      const hierarchy = parseProcessHierarchy(process.name);
      const processWithHierarchy = { ...process, ...hierarchy };
      
      // Initialize L1 group if needed
      if (!groups.has(hierarchy.l1)) {
        groups.set(hierarchy.l1, { l2Groups: new Map(), directProcesses: [] });
      }
      const l1Group = groups.get(hierarchy.l1)!;
      
      // If no L2, it's a direct L1 process
      if (hierarchy.l2 === "-") {
        l1Group.directProcesses.push(processWithHierarchy);
        continue;
      }
      
      // Initialize L2 group if needed
      if (!l1Group.l2Groups.has(hierarchy.l2)) {
        l1Group.l2Groups.set(hierarchy.l2, { l3Groups: new Map(), directProcesses: [] });
      }
      const l2Group = l1Group.l2Groups.get(hierarchy.l2)!;
      
      // If no L3, it's a direct L2 process
      if (hierarchy.l3 === "-") {
        l2Group.directProcesses.push(processWithHierarchy);
        continue;
      }
      
      // Initialize L3 group if needed
      if (!l2Group.l3Groups.has(hierarchy.l3)) {
        l2Group.l3Groups.set(hierarchy.l3, { processes: [] });
      }
      l2Group.l3Groups.get(hierarchy.l3)!.processes.push(processWithHierarchy);
    }
    
    // Sort and return as array
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredProcesses]);

  // Count total processes in L1 group
  const countL1Processes = (l1Group: L1Group): number => {
    let count = l1Group.directProcesses.length;
    for (const [, l2Group] of l1Group.l2Groups) {
      count += l2Group.directProcesses.length;
      for (const [, l3Group] of l2Group.l3Groups) {
        count += l3Group.processes.length;
      }
    }
    return count;
  };

  // Count total processes in L2 group
  const countL2Processes = (l2Group: L2Group): number => {
    let count = l2Group.directProcesses.length;
    for (const [, l3Group] of l2Group.l3Groups) {
      count += l3Group.processes.length;
    }
    return count;
  };

  const toggleL1 = (l1: string) => {
    setExpandedL1(prev => {
      const next = new Set(prev);
      if (next.has(l1)) {
        next.delete(l1);
      } else {
        next.add(l1);
      }
      return next;
    });
  };

  const toggleL2 = (l1: string, l2: string) => {
    const key = `${l1}:${l2}`;
    setExpandedL2(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allL1s = new Set(groupedProcesses.map(([l1]) => l1));
    const allL2s = new Set<string>();
    for (const [l1, l1Group] of groupedProcesses) {
      for (const [l2] of l1Group.l2Groups) {
        allL2s.add(`${l1}:${l2}`);
      }
    }
    setExpandedL1(allL1s);
    setExpandedL2(allL2s);
  };

  const collapseAll = () => {
    setExpandedL1(new Set());
    setExpandedL2(new Set());
  };

  const filteredPainPoints = useMemo(() => {
    if (!painPointSearch.trim()) return options.painPoints;
    return options.painPoints.filter((item) => 
      item.statement.toLowerCase().includes(painPointSearch.toLowerCase())
    );
  }, [options.painPoints, painPointSearch]);

  const filteredSolutions = useMemo(() => {
    if (!solutionSearch.trim()) return options.useCases;
    return options.useCases.filter((item) => 
      item.name.toLowerCase().includes(solutionSearch.toLowerCase())
    );
  }, [options.useCases, solutionSearch]);

  const openCreateForm = () => {
    if (!selectedUnitId) return;
    setEditingProcess(null);
    setFormState(emptyForm);
    setPainPointSearch("");
    setSolutionSearch("");
    setFormOpen(true);
  };

  const openEditForm = async (process: ProcessRecord) => {
    setEditingProcess(process);
    setFormState({
      name: process.name,
      description: process.description ?? "",
      volume: process.volume ? String(process.volume) : "",
      volumeUnit: process.volumeUnit ?? "",
      fte: process.fte ? String(process.fte) : "",
      owner: process.owner ?? "",
      painPointIds: [],
      useCaseIds: []
    });
    try {
      const response = await axios.get<{ painPointIds: string[]; useCaseIds: string[] }>(
        `${API_BASE}/api/processes/links/${process.id}`
      );
      setFormState((prev) => ({
        ...prev,
        painPointIds: response.data.painPointIds,
        useCaseIds: response.data.useCaseIds
      }));
    } catch {
      setError("Failed to load linked records");
    }
    setFormOpen(true);
  };

  const parseNumberField = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error("Numeric fields must be valid numbers");
    }
    return parsed;
  };

  const handleSave = async () => {
    const businessUnitIdToUse = editingProcess ? editingProcess.businessUnitId : selectedUnitId;
    
    if (!businessUnitIdToUse) {
      setError("Please select a business unit to create a new process");
      return;
    }
    if (!formState.name.trim()) {
      setError("Name must not be empty");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: ProcessPayload = {
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        volume: parseNumberField(formState.volume),
        volumeUnit: formState.volumeUnit.trim() || undefined,
        fte: parseNumberField(formState.fte),
        owner: formState.owner.trim() || undefined,
        businessUnitId: businessUnitIdToUse,
        painPointIds: formState.painPointIds,
        useCaseIds: formState.useCaseIds
      };

      if (editingProcess) {
        await axios.put(`${API_BASE}/api/processes/${editingProcess.id}`, payload);
      } else {
        await axios.post(`${API_BASE}/api/processes`, payload);
      }

      await refetchProcesses();
      setFormOpen(false);
      setEditingProcess(null);
      setFormState(emptyForm);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? "Failed to save process"
        : "Failed to save process";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (process: ProcessRecord) => {
    const confirmed = window.confirm(`Delete process "${process.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await axios.delete(`${API_BASE}/api/processes/${process.id}`);
      await refetchProcesses();
    } catch {
      setError("Failed to delete process");
    }
  };

  const toggleSelection = (field: "painPointIds" | "useCaseIds", id: string) => {
    setFormState((prev) => {
      const set = new Set(prev[field]);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      return { ...prev, [field]: Array.from(set) };
    });
  };

  return (
    <section className="space-y-4 sm:space-y-6 fade-in">
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Processes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage processes within each business unit and link them to pain points and solutions.
            </p>
          </div>
          <Button onClick={openCreateForm} disabled={!selectedUnitId} className="sm:mt-0">
            New process
          </Button>
        </div>
        {error ? <p className="text-sm text-red-500 font-medium mt-3">{error}</p> : null}
      </div>

      {!loading && processes.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Process Overview</h2>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Layers className="h-4 w-4" />
                <span className="text-xs font-medium">Total Processes</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{processStats.totalProcesses}</p>
            </div>
            
            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl p-4 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                <Link2 className="h-4 w-4" />
                <span className="text-xs font-medium">With Pain Points</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{processStats.withPainPoints}</p>
              <p className="text-xs text-muted-foreground">{processStats.totalPainPointLinks} links</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl p-4 border border-blue-500/20">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                <Lightbulb className="h-4 w-4" />
                <span className="text-xs font-medium">With Solutions</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{processStats.withUseCases}</p>
              <p className="text-xs text-muted-foreground">{processStats.totalUseCaseLinks} links</p>
            </div>
            
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl p-4 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs font-medium">Unlinked</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{processStats.withoutLinks}</p>
              <p className="text-xs text-muted-foreground">no connections</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Total FTE</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{processStats.totalFTE.toFixed(1)}</p>
            </div>
            
            <div className="bg-gradient-to-br from-slate-500/10 to-slate-500/5 rounded-xl p-4 border border-slate-500/20">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs font-medium">Categories</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{processStats.totalCategories}</p>
              <p className="text-xs text-muted-foreground">L1 categories</p>
            </div>
          </div>
          
          {processStats.l1Breakdown.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Top Categories by Process Count</h3>
              <div className="space-y-2">
                {processStats.l1Breakdown.map(([category, count]) => {
                  const percentage = processStats.totalProcesses > 0 
                    ? Math.round((count / processStats.totalProcesses) * 100) 
                    : 0;
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground truncate" title={category}>{category}</span>
                          <span className="text-xs text-muted-foreground ml-2">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <FilterByContext />

      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-foreground">Processes</h2>
            {loading && <span className="text-sm text-muted-foreground">Loading...</span>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll} disabled={groupedProcesses.length === 0}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} disabled={groupedProcesses.length === 0}>
                Collapse All
              </Button>
            </div>
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading processes...</div>
        ) : groupedProcesses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {search ? `No processes match "${search}"` : "No processes found. Create your first process to get started."}
          </div>
        ) : (
          <div className="space-y-3">
            {groupedProcesses.map(([l1, l1Group]) => {
              const isL1Expanded = expandedL1.has(l1);
              const l1ProcessCount = countL1Processes(l1Group);
              const sortedL2Groups = Array.from(l1Group.l2Groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
              
              return (
                <div key={l1} className="border border-border rounded-xl overflow-hidden">
                  {/* L1 Header */}
                  <button
                    onClick={() => toggleL1(l1)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isL1Expanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-semibold text-foreground">{l1}</span>
                      <span className="text-sm text-muted-foreground">
                        ({l1ProcessCount} {l1ProcessCount === 1 ? 'process' : 'processes'})
                      </span>
                    </div>
                  </button>
                  
                  {isL1Expanded && (
                    <div className="pl-4">
                      {/* Direct L1 processes (no L2) */}
                      {l1Group.directProcesses.length > 0 && (
                        <div className="py-2 space-y-1">
                          {l1Group.directProcesses.map((process) => (
                            <div key={process.id} className="flex items-center justify-between px-4 py-2 hover:bg-accent/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <span className="w-4" />
                                <span className="text-foreground">{process.l1}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Owner: {process.owner ?? "-"}</span>
                                <span>FTE: {process.fte ?? "-"}</span>
                                <span>Pain Points: {process.painPointCount}</span>
                                <span>Solutions: {process.useCaseCount}</span>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => openEditForm(process)}>Edit</Button>
                                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(process)}>Delete</Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* L2 Groups */}
                      {sortedL2Groups.map(([l2, l2Group]) => {
                        const l2Key = `${l1}:${l2}`;
                        const isL2Expanded = expandedL2.has(l2Key);
                        const l2ProcessCount = countL2Processes(l2Group);
                        const sortedL3Groups = Array.from(l2Group.l3Groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                        
                        return (
                          <div key={l2} className="border-l-2 border-border ml-2">
                            {/* L2 Header */}
                            <button
                              onClick={() => toggleL2(l1, l2)}
                              className="w-full flex items-center justify-between px-4 py-2 hover:bg-accent/50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-3">
                                {isL2Expanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-medium text-foreground">{l2}</span>
                                <span className="text-sm text-muted-foreground">
                                  ({l2ProcessCount})
                                </span>
                              </div>
                            </button>
                            
                            {isL2Expanded && (
                              <div className="pl-6">
                                {/* Direct L2 processes (no L3) */}
                                {l2Group.directProcesses.map((process) => (
                                  <div key={process.id} className="flex items-center justify-between px-4 py-2 hover:bg-accent/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                      <span className="w-4" />
                                      <span className="text-foreground">{process.l2}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <span>Owner: {process.owner ?? "-"}</span>
                                      <span>FTE: {process.fte ?? "-"}</span>
                                      <span>Pain Points: {process.painPointCount}</span>
                                      <span>Solutions: {process.useCaseCount}</span>
                                      <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => openEditForm(process)}>Edit</Button>
                                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(process)}>Delete</Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                
                                {/* L3 Groups */}
                                {sortedL3Groups.map(([l3, l3Group]) => (
                                  <div key={l3} className="border-l-2 border-border/50 ml-2 pl-4 py-1">
                                    <div className="text-sm font-medium text-muted-foreground mb-1">{l3}</div>
                                    {l3Group.processes.map((process) => (
                                      <div key={process.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50 rounded-lg">
                                        <span className="text-foreground">{process.l3}</span>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                          <span>Owner: {process.owner ?? "-"}</span>
                                          <span>FTE: {process.fte ?? "-"}</span>
                                          <span>Pain Points: {process.painPointCount}</span>
                                          <span>Solutions: {process.useCaseCount}</span>
                                          <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => openEditForm(process)}>Edit</Button>
                                            <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(process)}>Delete</Button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingProcess(null);
            setFormState(emptyForm);
          }
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProcess ? "Edit process" : "Create process"}</DialogTitle>
            <DialogDescription>
              Fields marked with * are required. Business and business unit are read only.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Input
                  value={formState.owner}
                  onChange={(event) => setFormState((prev) => ({ ...prev, owner: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Volume</Label>
                <Input
                  inputMode="decimal"
                  value={formState.volume}
                  onChange={(event) => setFormState((prev) => ({ ...prev, volume: event.target.value }))}
                  placeholder="e.g. 1200"
                />
              </div>
              <div className="space-y-2">
                <Label>Volume Unit</Label>
                <Select
                  value={formState.volumeUnit}
                  onChange={(event) => setFormState((prev) => ({ ...prev, volumeUnit: event.target.value }))}
                >
                  <option value="">Select unit...</option>
                  <option value="per day">per day</option>
                  <option value="per month">per month</option>
                  <option value="per year">per year</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>FTE</Label>
                <Input
                  inputMode="decimal"
                  value={formState.fte}
                  onChange={(event) => setFormState((prev) => ({ ...prev, fte: event.target.value }))}
                  placeholder="e.g. 2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                className="min-h-[90px] w-full rounded-xl border border-border bg-background text-foreground px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Business</p>
                <p className="text-base font-semibold">{selectedCompany?.name ?? ""}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Business Unit</p>
                <p className="text-base font-semibold">{selectedUnit?.name ?? ""}</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Link Pain Points</p>
                <Input
                  placeholder="Search pain points..."
                  value={painPointSearch}
                  onChange={(e) => setPainPointSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-background p-3">
                  {options.painPoints.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pain points available</p>
                  ) : filteredPainPoints.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matching pain points</p>
                  ) : (
                    filteredPainPoints.map((item: PainPointOption) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:bg-accent/50 rounded-lg p-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={formState.painPointIds.includes(item.id)}
                          onChange={() => toggleSelection("painPointIds", item.id)}
                          className="accent-primary"
                        />
                        <span>{item.statement}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Link Solutions</p>
                <Input
                  placeholder="Search solutions..."
                  value={solutionSearch}
                  onChange={(e) => setSolutionSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-background p-3">
                  {options.useCases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No solutions available</p>
                  ) : filteredSolutions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matching solutions</p>
                  ) : (
                    filteredSolutions.map((item: UseCaseOption) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:bg-accent/50 rounded-lg p-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={formState.useCaseIds.includes(item.id)}
                          onChange={() => toggleSelection("useCaseIds", item.id)}
                          className="accent-primary"
                        />
                        <span>{item.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 left-0 right-0 bg-background pt-4">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingProcess ? "Save changes" : "Create process"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
