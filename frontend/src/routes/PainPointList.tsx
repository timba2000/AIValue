import { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FilterByContext } from "@/components/FilterByContext";
import { LinkManagerModal } from "@/components/LinkManagerModal";
import { PainPointMetricsCards } from "@/components/PainPointMetricsCards";
import { PainPointsOverviewTable } from "@/components/dashboard/PainPointsOverviewTable";
import { useFilterStore } from "../stores/filterStore";
import { useAllBusinessUnits, useAllProcesses, useBusinessUnitsFlat, useCompanies } from "../hooks/useApiData";
import { getDescendantIds } from "../utils/hierarchy";
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
  companyId: string;
  businessUnitId: string;
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
  taxonomyLevel3Id: "",
  companyId: "",
  businessUnitId: ""
};

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

export default function PainPointList() {
  const queryClient = useQueryClient();
  const {
    selectedCompanyId,
    selectedBusinessUnitId,
    selectedProcessId,
    selectedL1Process,
    selectedL2Process,
    painPointFilter,
  } = useFilterStore();
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPainPoint, setEditingPainPoint] = useState<PainPoint | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedPainPointForLink, setSelectedPainPointForLink] = useState<PainPoint | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: companies = [] } = useCompanies();
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

  const { data: allLinks = [] } = useQuery<Array<{
    id: string;
    painPointId: string;
    useCaseId: string;
    useCaseName: string | null;
    percentageSolved: number | null;
    notes: string | null;
    processIds: string[];
  }>>({
    queryKey: ["allPainPointLinksDetails"],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/api/pain-point-links/details`);
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
    }
    
    let filteredProcesses = processes;
    
    if (selectedBusinessUnitId) {
      const descendantIds = getDescendantIds(businessUnitsHierarchy, selectedBusinessUnitId);
      const allUnitIds = new Set([selectedBusinessUnitId, ...descendantIds]);
      filteredProcesses = filteredProcesses.filter(p => allUnitIds.has(p.businessUnitId));
    } else if (selectedCompanyId) {
      const companyBuIds = new Set(businessUnits.filter(bu => bu.companyId === selectedCompanyId).map(bu => bu.id));
      filteredProcesses = filteredProcesses.filter(p => companyBuIds.has(p.businessUnitId));
    }
    
    if (selectedL1Process) {
      filteredProcesses = filteredProcesses.filter(p => {
        const { l1 } = parseProcessHierarchy(p.name);
        return l1 === selectedL1Process;
      });
    }
    
    if (selectedL2Process) {
      filteredProcesses = filteredProcesses.filter(p => {
        const { l2 } = parseProcessHierarchy(p.name);
        return l2 === selectedL2Process;
      });
    }
    
    if (filteredProcesses.length < processes.length || selectedL1Process || selectedL2Process) {
      return new Set(filteredProcesses.map(p => p.id));
    }
    
    return null;
  }, [selectedCompanyId, selectedBusinessUnitId, selectedProcessId, selectedL1Process, selectedL2Process, processes, businessUnits, businessUnitsHierarchy]);

  const validBusinessUnitIds = useMemo(() => {
    if (selectedBusinessUnitId) {
      const descendantIds = getDescendantIds(businessUnitsHierarchy, selectedBusinessUnitId);
      return new Set([selectedBusinessUnitId, ...descendantIds]);
    } else if (selectedCompanyId) {
      return new Set(businessUnits.filter(bu => bu.companyId === selectedCompanyId).map(bu => bu.id));
    }
    return null;
  }, [selectedCompanyId, selectedBusinessUnitId, businessUnits, businessUnitsHierarchy]);

  const filteredPainPoints = useMemo(() => {
    let filtered = painPoints;
    
    const hasProcessFilter = validProcessIds && validProcessIds.size > 0;
    const hasBusinessUnitFilter = validBusinessUnitIds && validBusinessUnitIds.size > 0;
    
    if (hasProcessFilter || hasBusinessUnitFilter) {
      filtered = filtered.filter(pp => {
        const matchesProcess = hasProcessFilter && pp.processIds && pp.processIds.some(id => validProcessIds.has(id));
        const matchesDirectBU = hasBusinessUnitFilter && pp.businessUnitId && validBusinessUnitIds.has(pp.businessUnitId);
        return matchesProcess || matchesDirectBU;
      });
    }

    if (painPointFilter === "linked") {
      filtered = filtered.filter(pp => linkStats[pp.id] && linkStats[pp.id] > 0);
    } else if (painPointFilter === "unlinked") {
      filtered = filtered.filter(pp => !linkStats[pp.id] || linkStats[pp.id] === 0);
    }
    
    return filtered;
  }, [painPoints, validProcessIds, validBusinessUnitIds, painPointFilter, linkStats]);

  const metricsData = useMemo(() => {
    const linkedCount = filteredPainPoints.filter(pp => 
      linkStats[pp.id] && linkStats[pp.id] > 0).length;
    const unlinkedCount = filteredPainPoints.length - linkedCount;

    const getL1Name = (l1Id: string | null | undefined) => {
      if (!l1Id) return null;
      const category = taxonomyCategories.find(c => c.id === l1Id);
      return category?.name?.toLowerCase() || null;
    };

    let peopleCount = 0;
    let processCount = 0;
    let technologyCount = 0;

    filteredPainPoints.forEach(pp => {
      const l1Name = getL1Name(pp.taxonomyLevel1Id);
      if (l1Name?.includes('people')) peopleCount++;
      else if (l1Name?.includes('process')) processCount++;
      else if (l1Name?.includes('technology') || l1Name?.includes('tech')) technologyCount++;
    });

    const total = filteredPainPoints.length;
    const peoplePercent = total > 0 ? Math.round((peopleCount / total) * 100) : 0;
    const processPercent = total > 0 ? Math.round((processCount / total) * 100) : 0;
    const technologyPercent = total > 0 ? Math.round((technologyCount / total) * 100) : 0;

    return {
      totalPainPoints: filteredPainPoints.length,
      linkedCount,
      unlinkedCount,
      peopleCount,
      peoplePercent,
      processCount,
      processPercent,
      technologyCount,
      technologyPercent
    };
  }, [filteredPainPoints, linkStats, taxonomyCategories]);

  const overviewTableData = useMemo(() => {
    return filteredPainPoints.map(pp => {
      const ppLinks = allLinks.filter(link => link.painPointId === pp.id);
      const totalPercentageSolved = ppLinks.reduce((sum, link) => sum + (link.percentageSolved ? Number(link.percentageSolved) : 0), 0);
      const cappedPercentage = Math.min(totalPercentageSolved, 100);
      const potentialHoursSaved = Number(pp.totalHoursPerMonth || 0) * (cappedPercentage / 100);
      
      return {
        id: pp.id,
        statement: pp.statement,
        magnitude: Number(pp.magnitude || 0),
        effortSolving: Number(pp.effortSolving || 0),
        totalHoursPerMonth: Number(pp.totalHoursPerMonth || 0),
        fteCount: Number(pp.fteCount || 0),
        hasLinks: ppLinks.length > 0,
        linkedSolutions: ppLinks.map(link => link.useCaseName).filter((name): name is string => name !== null),
        totalPercentageSolved,
        potentialHoursSaved: Math.round(potentialHoursSaved)
      };
    }).sort((a, b) => {
      const effortA = a.effortSolving === 0 ? 0.1 : (a.effortSolving || 10);
      const effortB = b.effortSolving === 0 ? 0.1 : (b.effortSolving || 10);
      const ratioA = a.magnitude / effortA;
      const ratioB = b.magnitude / effortB;
      return ratioB - ratioA;
    });
  }, [filteredPainPoints, allLinks]);

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
      taxonomyLevel3Id: painPoint.taxonomyLevel3Id ?? "",
      companyId: painPoint.companyId ?? "",
      businessUnitId: painPoint.businessUnitId ?? ""
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formState.statement.trim()) {
      setError("Statement is required");
      return;
    }
    if (!formState.companyId) {
      setError("Company is required");
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
      taxonomyLevel3Id: formState.taxonomyLevel3Id || null,
      companyId: formState.companyId || null,
      businessUnitId: formState.businessUnitId || null
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

      <PainPointMetricsCards
        totalPainPoints={metricsData.totalPainPoints}
        linkedCount={metricsData.linkedCount}
        unlinkedCount={metricsData.unlinkedCount}
        peopleCount={metricsData.peopleCount}
        peoplePercent={metricsData.peoplePercent}
        processCount={metricsData.processCount}
        processPercent={metricsData.processPercent}
        technologyCount={metricsData.technologyCount}
        technologyPercent={metricsData.technologyPercent}
      />

      <FilterByContext />

      <PainPointsOverviewTable
        data={overviewTableData}
        isLoading={loading && painPoints.length === 0}
        onManageClick={(painPointId) => {
          const pp = painPoints.find(p => p.id === painPointId);
          if (pp) handleOpenLinkModal(pp);
        }}
        onEditClick={(painPointId) => {
          const pp = painPoints.find(p => p.id === painPointId);
          if (pp) handleEdit(pp);
        }}
        onDeleteClick={handleDelete}
      />

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
              <Label htmlFor="companyId">Company <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground mt-0.5">Select the company for this pain point (required)</p>
              <Select
                id="companyId"
                value={formState.companyId}
                onChange={(e) => setFormState({ ...formState, companyId: e.target.value, businessUnitId: "" })}
                className="mt-1.5"
                required
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="businessUnitId">Business Unit</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Direct link to a business unit (optional, can be set later)</p>
              <Select
                id="businessUnitId"
                value={formState.businessUnitId}
                onChange={(e) => setFormState({ ...formState, businessUnitId: e.target.value })}
                className="mt-1.5"
                disabled={!formState.companyId}
              >
                <option value="">Select business unit (optional)</option>
                {businessUnits
                  .filter((bu) => formState.companyId ? bu.companyId === formState.companyId : true)
                  .map((bu) => (
                    <option key={bu.id} value={bu.id}>{bu.name}</option>
                  ))}
              </Select>
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
