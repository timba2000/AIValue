import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  } = useFilterStore();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProcessRecord | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [painPointSearch, setPainPointSearch] = useState("");
  const [solutionSearch, setSolutionSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  const filteredProcesses = useMemo(() => {
    if (!search.trim()) return processes;
    return processes.filter((process) => process.name.toLowerCase().includes(search.toLowerCase()));
  }, [processes, search]);

  // Group processes by L1
  const groupedProcesses = useMemo(() => {
    const groups: Map<string, Array<ProcessRecord & { l1: string; l2: string; l3: string }>> = new Map();
    
    for (const process of filteredProcesses) {
      const hierarchy = parseProcessHierarchy(process.name);
      const l1Key = hierarchy.l1;
      
      if (!groups.has(l1Key)) {
        groups.set(l1Key, []);
      }
      groups.get(l1Key)!.push({ ...process, ...hierarchy });
    }
    
    // Sort groups alphabetically by L1 name
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredProcesses]);

  // Auto-expand all groups when processes load or change
  useEffect(() => {
    const allL1s = new Set(groupedProcesses.map(([l1]) => l1));
    setExpandedGroups(allL1s);
  }, [groupedProcesses]);

  const toggleGroup = (l1: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(l1)) {
        next.delete(l1);
      } else {
        next.add(l1);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(groupedProcesses.map(([l1]) => l1)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
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
            {groupedProcesses.map(([l1, processesInGroup]) => {
              const isExpanded = expandedGroups.has(l1);
              return (
                <div key={l1} className="border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleGroup(l1)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-semibold text-foreground">{l1}</span>
                      <span className="text-sm text-muted-foreground">
                        ({processesInGroup.length} {processesInGroup.length === 1 ? 'process' : 'processes'})
                      </span>
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>L2</TableHead>
                            <TableHead>L3</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Volume</TableHead>
                            <TableHead>FTE</TableHead>
                            <TableHead>Pain Points</TableHead>
                            <TableHead>Solutions</TableHead>
                            <TableHead className="w-32">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {processesInGroup.map((process) => (
                            <TableRow key={process.id}>
                              <TableCell className="font-medium">{process.name}</TableCell>
                              <TableCell>{process.l2}</TableCell>
                              <TableCell>{process.l3}</TableCell>
                              <TableCell>{process.owner ?? "-"}</TableCell>
                              <TableCell>
                                {process.volume ?? "-"} {process.volumeUnit ?? ""}
                              </TableCell>
                              <TableCell>{process.fte ?? "-"}</TableCell>
                              <TableCell>{process.painPointCount}</TableCell>
                              <TableCell>{process.useCaseCount}</TableCell>
                              <TableCell className="space-x-2">
                                <Button variant="outline" size="sm" onClick={() => openEditForm(process)}>
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => handleDelete(process)}
                                >
                                  Delete
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
