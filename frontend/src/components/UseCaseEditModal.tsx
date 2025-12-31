import { useState, useEffect } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import type { UseCase, UseCasePayload, DataRequirement, RiskLevel } from "@/types/useCase";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const COMPLEXITY_OPTIONS = ["Low", "Medium", "High", "Very High"];
const DELIVERY_TIME_OPTIONS = ["Quick Win", "1 to 3 months", "3 to 6 months", "6 plus months"];
const COST_RANGE_OPTIONS = ["Low", "Medium", "High", "Very High"];
const CONFIDENCE_OPTIONS = ["Low", "Medium", "High"];
const DATA_REQUIREMENT_OPTIONS: DataRequirement[] = ["Structured", "Unstructured"];
const RISK_LEVELS: RiskLevel[] = ["High", "Medium", "Low"];

interface FormState {
  name: string;
  solutionProvider: string;
  problemToSolve: string;
  solutionOverview: string;
  complexity: string;
  dataRequirements: DataRequirement[];
  systemsImpacted: string;
  riskLevel: string;
  estimatedDeliveryTime: string;
  costRange: string;
  confidenceLevel: string;
  companyId: string;
  businessUnitId: string;
  processId: string;
}

const emptyForm: FormState = {
  name: "",
  solutionProvider: "",
  problemToSolve: "",
  solutionOverview: "",
  complexity: "Medium",
  dataRequirements: [],
  systemsImpacted: "",
  riskLevel: "",
  estimatedDeliveryTime: "Quick Win",
  costRange: "Medium",
  confidenceLevel: "Medium",
  companyId: "",
  businessUnitId: "",
  processId: ""
};

interface Company {
  id: string;
  name: string;
}

interface BusinessUnit {
  id: string;
  name: string;
  companyId: string;
  parentId: string | null;
}

interface Process {
  id: string;
  name: string;
  businessUnitId: string | null;
}

interface UseCaseEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  useCaseId: string | null;
  onSaveSuccess?: () => void;
}

export function UseCaseEditModal({ 
  open, 
  onOpenChange, 
  useCaseId,
  onSaveSuccess 
}: UseCaseEditModalProps) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: useCase, isLoading: loadingUseCase, refetch } = useQuery<UseCase>({
    queryKey: ["useCase", useCaseId],
    queryFn: async () => {
      const response = await axios.get<UseCase>(`${API_BASE}/api/use-cases/${useCaseId}`);
      return response.data;
    },
    enabled: !!useCaseId && open,
    staleTime: 0
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await axios.get<Company[]>(`${API_BASE}/api/companies`);
      return response.data;
    },
    enabled: open
  });

  const { data: businessUnits = [] } = useQuery<BusinessUnit[]>({
    queryKey: ["businessUnits"],
    queryFn: async () => {
      const response = await axios.get<BusinessUnit[]>(`${API_BASE}/api/business-units`);
      return response.data;
    },
    enabled: open
  });

  const { data: processes = [] } = useQuery<Process[]>({
    queryKey: ["processes"],
    queryFn: async () => {
      const response = await axios.get<Process[]>(`${API_BASE}/api/processes`);
      return response.data;
    },
    enabled: open
  });

  const filteredBusinessUnits = (formState.companyId
    ? businessUnits.filter(bu => bu.companyId === formState.companyId && !bu.parentId)
    : businessUnits.filter(bu => !bu.parentId)
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredProcesses = formState.businessUnitId
    ? processes.filter(p => p.businessUnitId === formState.businessUnitId)
    : processes;

  useEffect(() => {
    if (useCaseId && open) {
      setFormState(emptyForm);
      refetch();
    }
  }, [useCaseId, open, refetch]);

  useEffect(() => {
    if (useCase && open) {
      setFormState({
        name: useCase.name,
        solutionProvider: useCase.solutionProvider ?? "",
        problemToSolve: useCase.problemToSolve ?? "",
        solutionOverview: useCase.solutionOverview ?? "",
        complexity: useCase.complexity ?? "Medium",
        dataRequirements: useCase.dataRequirements ?? [],
        systemsImpacted: useCase.systemsImpacted ?? "",
        riskLevel: useCase.risks ?? "",
        estimatedDeliveryTime: useCase.estimatedDeliveryTime ?? "Quick Win",
        costRange: useCase.costRange ?? "Medium",
        confidenceLevel: useCase.confidenceLevel ?? "Medium",
        companyId: useCase.companyId ?? "",
        businessUnitId: useCase.businessUnitId ?? "",
        processId: useCase.processId ?? ""
      });
      setError(null);
    }
  }, [useCase, open]);

  useEffect(() => {
    if (!open) {
      setFormState(emptyForm);
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!formState.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formState.problemToSolve.trim()) {
      setError("Problem to solve is required");
      return;
    }
    if (!formState.solutionOverview.trim()) {
      setError("Solution overview is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload: UseCasePayload = {
      name: formState.name.trim(),
      solutionProvider: formState.solutionProvider || null,
      problemToSolve: formState.problemToSolve.trim(),
      solutionOverview: formState.solutionOverview.trim(),
      complexity: formState.complexity as "Low" | "Medium" | "High" | "Very High",
      dataRequirements: formState.dataRequirements.length > 0 ? formState.dataRequirements : null,
      systemsImpacted: formState.systemsImpacted || null,
      risks: formState.riskLevel ? (formState.riskLevel as RiskLevel) : null,
      estimatedDeliveryTime: formState.estimatedDeliveryTime as "Quick Win" | "1 to 3 months" | "3 to 6 months" | "6 plus months",
      costRange: formState.costRange as "Low" | "Medium" | "High" | "Very High",
      confidenceLevel: formState.confidenceLevel as "Low" | "Medium" | "High",
      alphaType: useCase?.alphaType ?? null,
      processId: formState.processId || null,
      companyId: formState.companyId || null,
      businessUnitId: formState.businessUnitId || null
    };

    try {
      if (useCaseId) {
        await axios.put(`${API_BASE}/api/use-cases/${useCaseId}`, payload);
      } else {
        await axios.post(`${API_BASE}/api/use-cases`, payload);
      }
      queryClient.invalidateQueries({ queryKey: ["use-cases"] });
      queryClient.invalidateQueries({ queryKey: ["useCases"] });
      queryClient.invalidateQueries({ queryKey: ["useCase", useCaseId] });
      onOpenChange(false);
      onSaveSuccess?.();
    } catch {
      setError("Failed to save solution");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{useCaseId ? "Edit Solution" : "Create Solution"}</DialogTitle>
          <DialogDescription>
            {useCaseId ? "Update the details of this solution" : "Add a new solution to track"}
          </DialogDescription>
        </DialogHeader>

        {loadingUseCase && useCaseId ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="name">Solution Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={formState.name}
                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                placeholder="Enter solution name..."
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="solutionProvider">Solution Provider</Label>
              <Input
                id="solutionProvider"
                value={formState.solutionProvider}
                onChange={(e) => setFormState({ ...formState, solutionProvider: e.target.value })}
                placeholder="Company or team providing this solution"
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="companyId">Company</Label>
                <Select
                  id="companyId"
                  value={formState.companyId}
                  onChange={(e) => setFormState({ 
                    ...formState, 
                    companyId: e.target.value,
                    businessUnitId: "",
                    processId: ""
                  })}
                  className="mt-1.5"
                >
                  <option value="">Select company...</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="businessUnitId">Business Unit</Label>
                <Select
                  id="businessUnitId"
                  value={formState.businessUnitId}
                  onChange={(e) => setFormState({ 
                    ...formState, 
                    businessUnitId: e.target.value,
                    processId: ""
                  })}
                  className="mt-1.5"
                >
                  <option value="">Select business unit...</option>
                  {filteredBusinessUnits.map((bu) => (
                    <option key={bu.id} value={bu.id}>{bu.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="processId">Process</Label>
                <Select
                  id="processId"
                  value={formState.processId}
                  onChange={(e) => setFormState({ ...formState, processId: e.target.value })}
                  className="mt-1.5"
                >
                  <option value="">Select process...</option>
                  {filteredProcesses.map((process) => (
                    <option key={process.id} value={process.id}>{process.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="problemToSolve">Problem to Solve <span className="text-destructive">*</span></Label>
              <Textarea
                id="problemToSolve"
                value={formState.problemToSolve}
                onChange={(e) => setFormState({ ...formState, problemToSolve: e.target.value })}
                rows={3}
                placeholder="What problem does this solution address?"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="solutionOverview">Solution Overview <span className="text-destructive">*</span></Label>
              <Textarea
                id="solutionOverview"
                value={formState.solutionOverview}
                onChange={(e) => setFormState({ ...formState, solutionOverview: e.target.value })}
                rows={3}
                placeholder="Describe the solution..."
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="complexity">Complexity</Label>
                <Select
                  id="complexity"
                  value={formState.complexity}
                  onChange={(e) => setFormState({ ...formState, complexity: e.target.value })}
                  className="mt-1.5"
                >
                  {COMPLEXITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="confidenceLevel">Confidence Level</Label>
                <Select
                  id="confidenceLevel"
                  value={formState.confidenceLevel}
                  onChange={(e) => setFormState({ ...formState, confidenceLevel: e.target.value })}
                  className="mt-1.5"
                >
                  {CONFIDENCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimatedDeliveryTime">Estimated Delivery Time</Label>
                <Select
                  id="estimatedDeliveryTime"
                  value={formState.estimatedDeliveryTime}
                  onChange={(e) => setFormState({ ...formState, estimatedDeliveryTime: e.target.value })}
                  className="mt-1.5"
                >
                  {DELIVERY_TIME_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="costRange">Cost Range</Label>
                <Select
                  id="costRange"
                  value={formState.costRange}
                  onChange={(e) => setFormState({ ...formState, costRange: e.target.value })}
                  className="mt-1.5"
                >
                  {COST_RANGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label>Data Requirements</Label>
              <div className="mt-1.5 flex gap-4">
                {DATA_REQUIREMENT_OPTIONS.map((req) => (
                  <label key={req} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formState.dataRequirements.includes(req)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormState({ ...formState, dataRequirements: [...formState.dataRequirements, req] });
                        } else {
                          setFormState({ ...formState, dataRequirements: formState.dataRequirements.filter(r => r !== req) });
                        }
                      }}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{req}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="systemsImpacted">Systems Impacted</Label>
              <Input
                id="systemsImpacted"
                value={formState.systemsImpacted}
                onChange={(e) => setFormState({ ...formState, systemsImpacted: e.target.value })}
                placeholder="Systems that will be affected"
                className="mt-1.5"
              />
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
                {RISK_LEVELS.map((risk) => (
                  <option key={risk} value={risk}>{risk}</option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
