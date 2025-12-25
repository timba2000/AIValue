import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAllBusinessUnits, useAllProcesses, useCompanies } from "../hooks/useApiData";
import type { PainPoint, PainPointPayload, ImpactType, RiskLevel } from "@/types/painPoint";
import { X, Plus, Link2 } from "lucide-react";

interface UseCase {
  id: string;
  name: string;
}

interface PainPointLink {
  id: string;
  painPointId: string;
  useCaseId: string;
  percentageSolved: number | null;
  useCaseName: string;
}

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

interface PainPointEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  painPointId: string | null;
  onSaveSuccess?: () => void;
}

export function PainPointEditModal({ 
  open, 
  onOpenChange, 
  painPointId,
  onSaveSuccess 
}: PainPointEditModalProps) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: companies = [] } = useCompanies();
  const { data: businessUnits = [] } = useAllBusinessUnits();
  const { data: processes = [] } = useAllProcesses();

  const { data: taxonomyCategories = [] } = useQuery<TaxonomyCategory[]>({
    queryKey: ["taxonomyCategories"],
    queryFn: async () => {
      const response = await axios.get<TaxonomyCategory[]>(`${API_BASE}/api/taxonomy`);
      return response.data;
    }
  });

  const { data: painPoint, isLoading: loadingPainPoint } = useQuery<PainPoint>({
    queryKey: ["painPoint", painPointId],
    queryFn: async () => {
      const response = await axios.get<PainPoint>(`${API_BASE}/api/pain-points/${painPointId}`);
      return response.data;
    },
    enabled: !!painPointId && open
  });

  const { data: useCases = [] } = useQuery<UseCase[]>({
    queryKey: ["useCases"],
    queryFn: async () => {
      const response = await axios.get<UseCase[]>(`${API_BASE}/api/use-cases`);
      return response.data;
    },
    enabled: open
  });

  const { data: painPointLinks = [], refetch: refetchLinks } = useQuery<PainPointLink[]>({
    queryKey: ["painPointLinks", painPointId],
    queryFn: async () => {
      const response = await axios.get<PainPointLink[]>(`${API_BASE}/api/pain-points/${painPointId}/links`);
      return response.data;
    },
    enabled: !!painPointId && open
  });

  const [newLinkUseCaseId, setNewLinkUseCaseId] = useState("");
  const [newLinkPercentage, setNewLinkPercentage] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [processSearchQuery, setProcessSearchQuery] = useState("");

  const availableUseCases = useMemo(() => {
    const linkedIds = new Set(painPointLinks.map(l => l.useCaseId));
    return useCases.filter(uc => !linkedIds.has(uc.id));
  }, [useCases, painPointLinks]);

  const { selectedProcesses, filteredUnselectedProcesses } = useMemo(() => {
    const selected = processes.filter(p => formState.processIds.includes(p.id));
    const unselected = processes.filter(p => !formState.processIds.includes(p.id));
    
    if (!processSearchQuery.trim()) {
      return { selectedProcesses: selected, filteredUnselectedProcesses: unselected };
    }
    
    const query = processSearchQuery.toLowerCase();
    const filteredUnselected = unselected.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
    
    return { selectedProcesses: selected, filteredUnselectedProcesses: filteredUnselected };
  }, [processes, processSearchQuery, formState.processIds]);

  const handleAddLink = async () => {
    if (!newLinkUseCaseId || !painPointId) return;
    
    const percentage = newLinkPercentage ? Number(newLinkPercentage) : null;
    if (percentage !== null && (percentage < 0 || percentage > 100)) {
      setLinkError("Percentage must be between 0 and 100");
      return;
    }

    setIsLinking(true);
    setLinkError(null);
    try {
      await axios.post(`${API_BASE}/api/pain-points/${painPointId}/links`, {
        useCaseId: newLinkUseCaseId,
        percentageSolved: percentage
      });
      setNewLinkUseCaseId("");
      setNewLinkPercentage("");
      refetchLinks();
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksDetails"] });
    } catch {
      setLinkError("Failed to link solution");
    } finally {
      setIsLinking(false);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!painPointId) return;
    try {
      await axios.delete(`${API_BASE}/api/pain-points/${painPointId}/links/${linkId}`);
      refetchLinks();
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksDetails"] });
    } catch {
      setLinkError("Failed to unlink solution");
    }
  };

  useEffect(() => {
    if (painPoint && open) {
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
      setError(null);
    }
  }, [painPoint, open]);

  useEffect(() => {
    if (!open) {
      setFormState(emptyForm);
      setError(null);
      setNewLinkUseCaseId("");
      setNewLinkPercentage("");
      setProcessSearchQuery("");
      setLinkError(null);
    }
  }, [open]);
  
  useEffect(() => {
    if (painPointId && open) {
      setFormState(emptyForm);
    }
  }, [painPointId, open]);

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
      if (painPointId) {
        await axios.put(`${API_BASE}/api/pain-points/${painPointId}`, payload);
      } else {
        await axios.post(`${API_BASE}/api/pain-points`, payload);
      }
      queryClient.invalidateQueries({ queryKey: ["painPoints"] });
      queryClient.invalidateQueries({ queryKey: ["painPoint", painPointId] });
      queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && query.queryKey[0] === "allPainPoints"
      });
      onOpenChange(false);
      onSaveSuccess?.();
    } catch {
      setError("Failed to save pain point");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{painPointId ? "Edit Pain Point" : "Create Pain Point"}</DialogTitle>
          <DialogDescription>
            {painPointId ? "Update the details of this pain point" : "Add a new pain point to track"}
          </DialogDescription>
        </DialogHeader>

        {loadingPainPoint && painPointId ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="statement">Pain Point Statement <span className="text-destructive">*</span></Label>
              <textarea
                id="statement"
                value={formState.statement}
                onChange={(e) => setFormState({ ...formState, statement: e.target.value })}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                placeholder="Describe the pain point..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="taxonomyLevel1">L1 - Category</Label>
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
              {processes.length > 0 && (
                <input
                  type="text"
                  value={processSearchQuery}
                  onChange={(e) => setProcessSearchQuery(e.target.value)}
                  placeholder="Search processes..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 mb-2"
                />
              )}
              <div className="mt-1.5 max-h-48 overflow-y-auto border border-border rounded-xl p-3 space-y-2">
                {processes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No processes available. Create processes first.</p>
                ) : (
                  <>
                    {selectedProcesses.map((process) => (
                      <label key={process.id} className="flex items-center space-x-2 bg-primary/10 hover:bg-primary/20 p-1 rounded-lg transition-colors">
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => {
                            setFormState({ ...formState, processIds: formState.processIds.filter(id => id !== process.id) });
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
                    ))}
                    {selectedProcesses.length > 0 && filteredUnselectedProcesses.length > 0 && (
                      <div className="border-t border-border my-2" />
                    )}
                    {filteredUnselectedProcesses.length === 0 && processSearchQuery.trim() ? (
                      <p className="text-sm text-muted-foreground">No other processes match your search.</p>
                    ) : (
                      filteredUnselectedProcesses.map((process) => (
                        <label key={process.id} className="flex items-center space-x-2 hover:bg-accent/50 p-1 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => {
                              setFormState({ ...formState, processIds: [...formState.processIds, process.id] });
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
                  </>
                )}
              </div>
              {formState.processIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {formState.processIds.length} process{formState.processIds.length > 1 ? 'es' : ''} selected
                </p>
              )}
            </div>

            {painPointId && (
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <Label>Linked Solutions</Label>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Connect solutions that address this pain point</p>

                {linkError && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm mb-3">
                    {linkError}
                  </div>
                )}

                {painPointLinks.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {painPointLinks.map((link) => (
                      <div key={link.id} className="flex items-center justify-between p-2 bg-accent/30 rounded-lg">
                        <div className="flex-1">
                          <span className="text-sm font-medium">{link.useCaseName}</span>
                          {link.percentageSolved !== null && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({link.percentageSolved}% solved)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(link.id)}
                          className="p-1 hover:bg-destructive/20 rounded text-destructive transition-colors"
                          title="Unlink solution"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {availableUseCases.length > 0 ? (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label htmlFor="newLinkUseCase" className="text-xs">Solution</Label>
                      <Select
                        id="newLinkUseCase"
                        value={newLinkUseCaseId}
                        onChange={(e) => setNewLinkUseCaseId(e.target.value)}
                        className="mt-1"
                      >
                        <option value="">Select solution...</option>
                        {availableUseCases.map((uc) => (
                          <option key={uc.id} value={uc.id}>{uc.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="w-24">
                      <Label htmlFor="newLinkPercentage" className="text-xs">% Solved</Label>
                      <input
                        id="newLinkPercentage"
                        type="number"
                        min="0"
                        max="100"
                        value={newLinkPercentage}
                        onChange={(e) => setNewLinkPercentage(e.target.value)}
                        placeholder="0-100"
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddLink}
                      disabled={!newLinkUseCaseId || isLinking}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {isLinking ? "..." : "Link"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {useCases.length === 0 
                      ? "No solutions available. Create solutions first."
                      : "All available solutions are already linked."}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || loadingPainPoint}>
            {isSaving ? "Saving..." : (painPointId ? "Save changes" : "Create pain point")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
