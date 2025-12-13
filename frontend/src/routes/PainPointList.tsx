import { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FilterByContext } from "@/components/FilterByContext";
import { LinkManagerModal } from "@/components/LinkManagerModal";
import { useFilterStore } from "../stores/filterStore";
import { useAllBusinessUnits, useAllProcesses, useBusinessUnitsFlat } from "../hooks/useApiData";
import { getDescendantIds } from "../utils/hierarchy";
import { Link2, Check, AlertCircle } from "lucide-react";
import type { PainPoint, PainPointPayload, ImpactType, RiskLevel } from "@/types/painPoint";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const IMPACT_TYPES: { value: ImpactType; label: string }[] = [
  { value: "time_waste", label: "Time Waste" },
  { value: "quality_issue", label: "Quality Issue" },
  { value: "compliance_risk", label: "Compliance Risk" },
  { value: "cost_overrun", label: "Cost Overrun" },
  { value: "customer_impact", label: "Customer Impact" },
  { value: "other", label: "Other" }
];

const RISK_LEVELS: { value: RiskLevel; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" }
];

interface TaxonomyCategory {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
}

interface FormState {
  statement: string;
  impactType: string[];
  businessImpact: string;
  magnitude: string;
  frequency: string;
  timePerUnit: string;
  fteCount: string;
  rootCause: string;
  workarounds: string;
  dependencies: string;
  riskLevel: string;
  effortSolving: string;
  processIds: string[];
  taxonomyLevel1Id: string;
  taxonomyLevel2Id: string;
  taxonomyLevel3Id: string;
}

const emptyForm: FormState = {
  statement: "",
  impactType: [],
  businessImpact: "",
  magnitude: "",
  frequency: "",
  timePerUnit: "",
  fteCount: "",
  rootCause: "",
  workarounds: "",
  dependencies: "",
  riskLevel: "",
  effortSolving: "",
  processIds: [],
  taxonomyLevel1Id: "",
  taxonomyLevel2Id: "",
  taxonomyLevel3Id: ""
};

export default function PainPointList() {
  const queryClient = useQueryClient();
  const {
    selectedCompanyId,
    selectedBusinessUnitId,
    selectedProcessId,
  } = useFilterStore();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPainPoint, setEditingPainPoint] = useState<PainPoint | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedPainPointForLink, setSelectedPainPointForLink] = useState<PainPoint | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: businessUnits = [] } = useAllBusinessUnits();
  const { data: processes = [] } = useAllProcesses();
  const { data: businessUnitsHierarchy = [] } = useBusinessUnitsFlat(selectedCompanyId);

  const { data: painPoints = [], isLoading: loading, refetch: refetchPainPoints, error: painPointsError } = useQuery<PainPoint[]>({
    queryKey: ["painPoints"],
    queryFn: async () => {
      const response = await axios.get<PainPoint[]>(`${API_BASE}/api/pain-points`);
      return response.data;
    }
  });

  const { data: linkStats = {} } = useQuery<Record<string, number>>({
    queryKey: ["allPainPointLinksStats"],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/api/pain-point-links/stats`);
      return response.data;
    }
  });

  const { data: taxonomyCategories = [] } = useQuery<TaxonomyCategory[]>({
    queryKey: ["taxonomyCategories"],
    queryFn: async () => {
      const response = await axios.get<TaxonomyCategory[]>(`${API_BASE}/api/taxonomy`);
      return response.data;
    }
  });

  const level1Categories = useMemo(() => 
    taxonomyCategories.filter(c => c.level === 1), 
    [taxonomyCategories]
  );

  const level2Categories = useMemo(() => 
    taxonomyCategories.filter(c => c.level === 2 && c.parentId === formState.taxonomyLevel1Id), 
    [taxonomyCategories, formState.taxonomyLevel1Id]
  );

  const level3Categories = useMemo(() => 
    taxonomyCategories.filter(c => c.level === 3 && c.parentId === formState.taxonomyLevel2Id), 
    [taxonomyCategories, formState.taxonomyLevel2Id]
  );

  const getTaxonomyName = (id: string | null | undefined) => {
    if (!id) return null;
    const category = taxonomyCategories.find(c => c.id === id);
    return category?.name || null;
  };

  useEffect(() => {
    if (painPointsError) {
      setError("Failed to load pain points");
    }
  }, [painPointsError]);

  const handleOpenLinkModal = (painPoint: PainPoint) => {
    setSelectedPainPointForLink(painPoint);
    setLinkModalOpen(true);
  };

  const validProcessIds = useMemo(() => {
    if (selectedProcessId) {
      return new Set([selectedProcessId]);
    } else if (selectedBusinessUnitId) {
      const descendantIds = getDescendantIds(businessUnitsHierarchy, selectedBusinessUnitId);
      const allUnitIds = new Set([selectedBusinessUnitId, ...descendantIds]);
      return new Set(processes.filter(p => allUnitIds.has(p.businessUnitId)).map(p => p.id));
    } else if (selectedCompanyId) {
      const companyBuIds = new Set(businessUnits.filter(bu => bu.companyId === selectedCompanyId).map(bu => bu.id));
      return new Set(processes.filter(p => companyBuIds.has(p.businessUnitId)).map(p => p.id));
    }
    return null;
  }, [selectedCompanyId, selectedBusinessUnitId, selectedProcessId, processes, businessUnits, businessUnitsHierarchy]);

  const filteredPainPoints = useMemo(() => {
    let filtered = painPoints;
    
    if (validProcessIds) {
      filtered = filtered.filter(pp => 
        pp.processIds && pp.processIds.some(id => validProcessIds.has(id))
      );
    }
    
    if (search.trim()) {
      filtered = filtered.filter(pp => 
        pp.statement.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    return filtered;
  }, [painPoints, validProcessIds, search]);


  const handleCreate = () => {
    setEditingPainPoint(null);
    setFormState(emptyForm);
    setFormOpen(true);
  };

  const handleEdit = (painPoint: PainPoint) => {
    setEditingPainPoint(painPoint);
    setFormState({
      statement: painPoint.statement,
      impactType: painPoint.impactType ?? [],
      businessImpact: painPoint.businessImpact ?? "",
      magnitude: painPoint.magnitude?.toString() ?? "",
      frequency: painPoint.frequency?.toString() ?? "",
      timePerUnit: painPoint.timePerUnit?.toString() ?? "",
      fteCount: painPoint.fteCount?.toString() ?? "",
      rootCause: painPoint.rootCause ?? "",
      workarounds: painPoint.workarounds ?? "",
      dependencies: painPoint.dependencies ?? "",
      riskLevel: painPoint.riskLevel ?? "",
      effortSolving: painPoint.effortSolving?.toString() ?? "",
      processIds: painPoint.processIds ?? [],
      taxonomyLevel1Id: painPoint.taxonomyLevel1Id ?? "",
      taxonomyLevel2Id: painPoint.taxonomyLevel2Id ?? "",
      taxonomyLevel3Id: painPoint.taxonomyLevel3Id ?? ""
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formState.statement.trim()) {
      setError("Statement is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload: PainPointPayload = {
      statement: formState.statement.trim(),
      impactType: formState.impactType.length > 0 ? formState.impactType : null,
      businessImpact: formState.businessImpact || null,
      magnitude: formState.magnitude ? Number(formState.magnitude) : null,
      frequency: formState.frequency ? Number(formState.frequency) : null,
      timePerUnit: formState.timePerUnit ? Number(formState.timePerUnit) : null,
      fteCount: formState.fteCount ? Number(formState.fteCount) : null,
      rootCause: formState.rootCause || null,
      workarounds: formState.workarounds || null,
      dependencies: formState.dependencies || null,
      riskLevel: formState.riskLevel || null,
      effortSolving: formState.effortSolving ? Number(formState.effortSolving) : null,
      processIds: formState.processIds,
      taxonomyLevel1Id: formState.taxonomyLevel1Id || null,
      taxonomyLevel2Id: formState.taxonomyLevel2Id || null,
      taxonomyLevel3Id: formState.taxonomyLevel3Id || null
    };

    try {
      if (editingPainPoint) {
        await axios.put(`${API_BASE}/api/pain-points/${editingPainPoint.id}`, payload);
      } else {
        await axios.post(`${API_BASE}/api/pain-points`, payload);
      }
      setFormOpen(false);
      await refetchPainPoints();
    } catch {
      setError("Failed to save pain point");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pain point?")) return;

    setIsSaving(true);
    setError(null);

    try {
      await axios.delete(`${API_BASE}/api/pain-points/${id}`);
      await refetchPainPoints();
    } catch {
      setError("Failed to delete pain point");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-4 sm:space-y-6 fade-in">
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Pain Points</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Identify and track process pain points across your organization
            </p>
          </div>
          <Button onClick={handleCreate} className="shrink-0">
            New pain point
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <FilterByContext />

      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-foreground">Pain Points List</h2>
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search by statement..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
            />
          </div>
        </div>

        {loading && painPoints.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Loading pain points...</div>
        ) : filteredPainPoints.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {search ? "No pain points match your search" : "No pain points yet. Create one to get started!"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Statement</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Category</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Impact Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Risk Level</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Impact (1-10)</th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Total Hrs/Month</th>
                  <th className="text-center py-3 px-4 font-semibold text-muted-foreground">Linked Solutions</th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPainPoints.map((pp) => (
                  <tr key={pp.id} className="hover:bg-accent/50 transition-colors duration-150">
                    <td className="py-3 px-4">{pp.statement}</td>
                    <td className="py-3 px-4">
                      {pp.taxonomyLevel1Id ? (
                        <span className="text-sm">
                          {getTaxonomyName(pp.taxonomyLevel1Id)}
                          {pp.taxonomyLevel2Id && ` > ${getTaxonomyName(pp.taxonomyLevel2Id)}`}
                          {pp.taxonomyLevel3Id && ` > ${getTaxonomyName(pp.taxonomyLevel3Id)}`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {pp.impactType && pp.impactType.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {pp.impactType.map((type) => (
                            <span key={type} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                              {IMPACT_TYPES.find((t) => t.value === type)?.label ?? type}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {pp.riskLevel ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            pp.riskLevel === "critical"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : pp.riskLevel === "high"
                              ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                              : pp.riskLevel === "medium"
                              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                              : "bg-green-500/10 text-green-600 dark:text-green-400"
                          }`}
                        >
                          {RISK_LEVELS.find((r) => r.value === pp.riskLevel)?.label ?? pp.riskLevel}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{pp.magnitude ?? "-"}</td>
                    <td className="py-3 px-4">
                      {pp.totalHoursPerMonth ? (
                        <span className="font-medium text-foreground">{Number(pp.totalHoursPerMonth).toFixed(1)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {linkStats[pp.id] && linkStats[pp.id] > 0 ? (
                        <button
                          onClick={() => handleOpenLinkModal(pp)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors text-xs font-medium"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {linkStats[pp.id]} linked
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenLinkModal(pp)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors text-xs font-medium border border-amber-500/20"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Not linked
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenLinkModal(pp)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg transition-colors"
                          title="Link solutions"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Link
                        </button>
                        <button
                          onClick={() => handleEdit(pp)}
                          className="text-primary hover:text-primary/80 font-medium text-xs px-2 py-1 hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(pp.id)}
                          className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium text-xs px-2 py-1 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPainPoint ? "Edit Pain Point" : "Create Pain Point"}</DialogTitle>
            <DialogDescription>
              {editingPainPoint
                ? "Update the pain point details below"
                : "Add a new pain point to track process inefficiencies"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="statement">
                Statement <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="statement"
                value={formState.statement}
                onChange={(e) => setFormState({ ...formState, statement: e.target.value })}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                placeholder="Describe the pain point"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="taxonomyLevel1">L1 - Category <span className="text-red-500">*</span></Label>
                <Select
                  id="taxonomyLevel1"
                  value={formState.taxonomyLevel1Id}
                  onChange={(e) => setFormState({ 
                    ...formState, 
                    taxonomyLevel1Id: e.target.value,
                    taxonomyLevel2Id: "",
                    taxonomyLevel3Id: ""
                  })}
                  className="mt-1.5"
                >
                  <option value="">Select category</option>
                  {level1Categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="taxonomyLevel2">L2 - Sub-category</Label>
                <Select
                  id="taxonomyLevel2"
                  value={formState.taxonomyLevel2Id}
                  onChange={(e) => setFormState({ 
                    ...formState, 
                    taxonomyLevel2Id: e.target.value,
                    taxonomyLevel3Id: ""
                  })}
                  className="mt-1.5"
                  disabled={!formState.taxonomyLevel1Id || level2Categories.length === 0}
                >
                  <option value="">Select sub-category</option>
                  {level2Categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="taxonomyLevel3">L3 - Description</Label>
                <Select
                  id="taxonomyLevel3"
                  value={formState.taxonomyLevel3Id}
                  onChange={(e) => setFormState({ ...formState, taxonomyLevel3Id: e.target.value })}
                  className="mt-1.5"
                  disabled={!formState.taxonomyLevel2Id || level3Categories.length === 0}
                >
                  <option value="">Select detail</option>
                  {level3Categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Impact Type (Select all that apply)</Label>
                <div className="mt-1.5 space-y-2">
                  {IMPACT_TYPES.map((type) => (
                    <label key={type.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formState.impactType.includes(type.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormState({ ...formState, impactType: [...formState.impactType, type.value] });
                          } else {
                            setFormState({ ...formState, impactType: formState.impactType.filter(t => t !== type.value) });
                          }
                        }}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="riskLevel">Risk Level</Label>
                <Select
                  id="riskLevel"
                  value={formState.riskLevel}
                  onChange={(e) => setFormState({ ...formState, riskLevel: e.target.value })}
                  className="mt-1.5"
                >
                  <option value="">Select risk level</option>
                  {RISK_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="businessImpact">Business Impact</Label>
              <textarea
                id="businessImpact"
                value={formState.businessImpact}
                onChange={(e) => setFormState({ ...formState, businessImpact: e.target.value })}
                rows={2}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                placeholder="How does this affect the business?"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="magnitude">Impact of Pain Point (1-10)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">1 = Low impact, 10 = High impact</p>
                <input
                  id="magnitude"
                  type="number"
                  min="1"
                  max="10"
                  value={formState.magnitude}
                  onChange={(e) => setFormState({ ...formState, magnitude: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                  placeholder="1-10"
                />
              </div>

              <div>
                <Label htmlFor="effortSolving">Effort in Solving (1-10)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">1 = Low effort, 10 = High effort</p>
                <input
                  id="effortSolving"
                  type="number"
                  min="1"
                  max="10"
                  value={formState.effortSolving}
                  onChange={(e) => setFormState({ ...formState, effortSolving: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                  placeholder="1-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="frequency">Frequency (per month)</Label>
                <input
                  id="frequency"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.frequency}
                  onChange={(e) => setFormState({ ...formState, frequency: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                  placeholder="Times per month"
                />
              </div>

              <div>
                <Label htmlFor="timePerUnit">Time Required per unit (Hrs)</Label>
                <input
                  id="timePerUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.timePerUnit}
                  onChange={(e) => setFormState({ ...formState, timePerUnit: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                  placeholder="Hours per unit"
                />
              </div>

              <div>
                <Label htmlFor="fteCount"># FTE on painpoint</Label>
                <input
                  id="fteCount"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formState.fteCount}
                  onChange={(e) => setFormState({ ...formState, fteCount: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                  placeholder="Number of FTEs"
                />
              </div>
            </div>

            {formState.frequency && formState.timePerUnit && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                <Label className="text-primary">Total Hours per Month (Auto-calculated)</Label>
                <p className="text-lg font-semibold text-primary mt-1">
                  {(Number(formState.frequency) * Number(formState.timePerUnit)).toFixed(2)} hours
                </p>
                <p className="text-xs text-primary/80 mt-1">This value is automatically calculated when you save</p>
              </div>
            )}

            <div>
              <Label htmlFor="rootCause">Root Cause</Label>
              <textarea
                id="rootCause"
                value={formState.rootCause}
                onChange={(e) => setFormState({ ...formState, rootCause: e.target.value })}
                rows={2}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                placeholder="Why is this happening?"
              />
            </div>

            <div>
              <Label htmlFor="workarounds">Current Workarounds</Label>
              <textarea
                id="workarounds"
                value={formState.workarounds}
                onChange={(e) => setFormState({ ...formState, workarounds: e.target.value })}
                rows={2}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                placeholder="What temporary fixes exist?"
              />
            </div>

            <div>
              <Label htmlFor="dependencies">Dependencies</Label>
              <textarea
                id="dependencies"
                value={formState.dependencies}
                onChange={(e) => setFormState({ ...formState, dependencies: e.target.value })}
                rows={2}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                placeholder="What other systems or processes are involved?"
              />
            </div>

            <div>
              <Label>Linked Processes</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">Select processes affected by this pain point</p>
              <div className="mt-1.5 max-h-48 overflow-y-auto border border-border rounded-xl p-3 space-y-2">
                {processes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No processes available. Create processes first.</p>
                ) : (
                  processes.map((process) => (
                    <label key={process.id} className="flex items-center space-x-2 hover:bg-accent/50 p-1 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={formState.processIds.includes(process.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormState({ ...formState, processIds: [...formState.processIds, process.id] });
                          } else {
                            setFormState({ ...formState, processIds: formState.processIds.filter(id => id !== process.id) });
                          }
                        }}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm flex-1">
                        {process.name}
                        {process.description && (
                          <span className="text-muted-foreground text-xs ml-1">- {process.description}</span>
                        )}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {formState.processIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {formState.processIds.length} process{formState.processIds.length > 1 ? 'es' : ''} selected
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {editingPainPoint ? "Save changes" : "Create pain point"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedPainPointForLink && (
        <LinkManagerModal
          open={linkModalOpen}
          onOpenChange={setLinkModalOpen}
          mode="pain-point"
          sourceId={selectedPainPointForLink.id}
          sourceName={selectedPainPointForLink.statement}
        />
      )}
    </section>
  );
}
