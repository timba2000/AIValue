import { useEffect, useMemo, useState } from "react";
import axios from "axios";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BusinessUnit, Company } from "@/types/business";
import type { PainPointOption, ProcessOptionsResponse, ProcessPayload, ProcessRecord, UseCaseOption } from "@/types/process";

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
  const [companies, setCompanies] = useState<Company[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [processes, setProcesses] = useState<ProcessRecord[]>([]);
  const [options, setOptions] = useState<ProcessOptionsResponse>({ painPoints: [], useCases: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<ProcessRecord | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);

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

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await axios.get<Company[]>(`${API_BASE}/api/companies`);
        setCompanies(response.data);
        if (response.data.length > 0) {
          const first = response.data[0];
          setSelectedCompanyId(first.id);
        }
      } catch (error) {
        console.error(error);
        setError("Failed to load businesses");
      }
    };

    fetchCompanies();
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) return;

    const fetchUnits = async () => {
      try {
        const response = await axios.get<BusinessUnit[]>(
          `${API_BASE}/api/companies/${selectedCompanyId}/business-units`
        );
        setBusinessUnits(response.data);
        if (response.data.length > 0) {
          const first = response.data[0];
          setSelectedUnitId(first.id);
        } else {
          setSelectedUnitId("");
          setProcesses([]);
        }
      } catch (error) {
        console.error(error);
        setError("Failed to load business units");
      }
    };

    fetchUnits();
  }, [selectedCompanyId]);

  const fetchProcesses = async (businessUnitId: string) => {
    if (!businessUnitId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<ProcessRecord[]>(`${API_BASE}/api/processes`, {
        params: { businessUnitId }
      });
      setProcesses(response.data);
    } catch (error) {
      console.error(error);
      setError("Failed to load processes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUnitId) {
      fetchProcesses(selectedUnitId);
    }
  }, [selectedUnitId]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await axios.get<ProcessOptionsResponse>(`${API_BASE}/api/processes/options`);
        setOptions(response.data);
      } catch (error) {
        console.error(error);
        setError("Failed to load linking options");
      }
    };

    fetchOptions();
  }, []);

  const handleSelectCompany = (id: string) => {
    setSelectedCompanyId(id);
    setSelectedUnitId("");
    setProcesses([]);
  };

  const handleSelectUnit = (id: string) => {
    setSelectedUnitId(id);
  };

  const openCreateForm = () => {
    if (!selectedUnitId) return;
    setEditingProcess(null);
    setFormState(emptyForm);
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
    } catch (error) {
      console.error(error);
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
    if (!selectedUnitId) return;
    if (!formState.name.trim()) {
      setError("Name must not be empty");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: ProcessPayload = {
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        volume: parseNumberField(formState.volume),
        volumeUnit: formState.volumeUnit.trim() || undefined,
        fte: parseNumberField(formState.fte),
        owner: formState.owner.trim() || undefined,
        businessUnitId: selectedUnitId,
        painPointIds: formState.painPointIds,
        useCaseIds: formState.useCaseIds
      };

      if (editingProcess) {
        await axios.put(`${API_BASE}/api/processes/${editingProcess.id}`, payload);
      } else {
        await axios.post(`${API_BASE}/api/processes`, payload);
      }

      await fetchProcesses(selectedUnitId);
      setFormOpen(false);
      setEditingProcess(null);
      setFormState(emptyForm);
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ?? "Failed to save process"
        : "Failed to save process";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (process: ProcessRecord) => {
    const confirmed = window.confirm(`Delete process "${process.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await axios.delete(`${API_BASE}/api/processes/${process.id}`);
      await fetchProcesses(process.businessUnitId);
    } catch (error) {
      console.error(error);
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
    <section className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Processes</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage processes within each business unit and link them to pain points and use cases.
            </p>
          </div>
          <Button onClick={openCreateForm} disabled={!selectedUnitId} className="sm:mt-0">
            New process
          </Button>
        </div>
        {error ? <p className="text-sm text-red-600 font-medium mt-3">{error}</p> : null}
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="business-select">Business</Label>
            <select
              id="business-select"
              className="w-full rounded border px-3 py-2"
              value={selectedCompanyId}
              onChange={(event) => handleSelectCompany(event.target.value)}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-select">Business Unit</Label>
            <select
              id="unit-select"
              className="w-full rounded border px-3 py-2"
              value={selectedUnitId}
              onChange={(event) => handleSelectUnit(event.target.value)}
            >
              {businessUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </aside>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Processes</h2>
            {loading && <span className="text-sm text-muted-foreground">Loading...</span>}
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>FTE</TableHead>
                  <TableHead>Pain Points</TableHead>
                  <TableHead>Use Cases</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProcesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      No processes found for this business unit.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProcesses.map((process) => (
                    <TableRow key={process.id}>
                      <TableCell className="font-medium">{process.name}</TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
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
                <Input
                  value={formState.volumeUnit}
                  onChange={(event) => setFormState((prev) => ({ ...prev, volumeUnit: event.target.value }))}
                  placeholder="per month"
                />
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
                className="min-h-[90px] w-full rounded border px-3 py-2"
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
                <p className="text-sm font-semibold">Link Pain Points</p>
                <div className="space-y-2 max-h-48 overflow-y-auto rounded border p-2">
                  {options.painPoints.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pain points available</p>
                  ) : (
                    options.painPoints.map((item: PainPointOption) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formState.painPointIds.includes(item.id)}
                          onChange={() => toggleSelection("painPointIds", item.id)}
                        />
                        <span>{item.statement}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Link Use Cases</p>
                <div className="space-y-2 max-h-48 overflow-y-auto rounded border p-2">
                  {options.useCases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No use cases available</p>
                  ) : (
                    options.useCases.map((item: UseCaseOption) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formState.useCaseIds.includes(item.id)}
                          onChange={() => toggleSelection("useCaseIds", item.id)}
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
            <Button onClick={handleSave} disabled={loading}>
              {editingProcess ? "Save changes" : "Create process"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
