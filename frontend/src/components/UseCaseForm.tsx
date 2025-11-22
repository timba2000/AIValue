import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUseCase, updateUseCase } from "@/api/useCases";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProcessRecord } from "@/types/process";
import type { UseCase, UseCasePayload } from "@/types/useCase";

interface UseCaseFormProps {
  selectedUseCase: UseCase | null;
  processes: ProcessRecord[];
  onSuccess: () => void;
}

const DEFAULT_STATE: UseCasePayload = {
  name: "",
  description: "",
  problemToSolve: "",
  solutionOverview: "",
  expectedBenefits: "",
  valueDrivers: "",
  complexity: "Medium",
  dataRequirements: "",
  systemsImpacted: "",
  risks: "",
  estimatedFTEHours: null,
  estimatedDeliveryTime: "Quick Win",
  costRange: "Medium",
  roiEstimate: "",
  confidenceLevel: "Medium",
  processId: ""
};

export function UseCaseForm({ selectedUseCase, processes, onSuccess }: UseCaseFormProps) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<UseCasePayload>(DEFAULT_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedUseCase) {
      setFormState({
        name: selectedUseCase.name,
        description: selectedUseCase.description ?? "",
        problemToSolve: selectedUseCase.problemToSolve,
        solutionOverview: selectedUseCase.solutionOverview,
        expectedBenefits: selectedUseCase.expectedBenefits ?? "",
        valueDrivers: selectedUseCase.valueDrivers ?? "",
        complexity: selectedUseCase.complexity,
        dataRequirements: selectedUseCase.dataRequirements ?? "",
        systemsImpacted: selectedUseCase.systemsImpacted ?? "",
        risks: selectedUseCase.risks ?? "",
        estimatedFTEHours: selectedUseCase.estimatedFTEHours,
        estimatedDeliveryTime: selectedUseCase.estimatedDeliveryTime ?? "Quick Win",
        costRange: selectedUseCase.costRange ?? "Medium",
        roiEstimate: selectedUseCase.roiEstimate ?? "",
        confidenceLevel: selectedUseCase.confidenceLevel ?? "Medium",
        processId: selectedUseCase.processId
      });
    } else {
      setFormState(DEFAULT_STATE);
    }
  }, [selectedUseCase]);

  const createMutation = useMutation({
    mutationFn: createUseCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["use-cases"] });
      onSuccess();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UseCasePayload }) => updateUseCase(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["use-cases"] });
      onSuccess();
    }
  });

  const validate = (state: UseCasePayload) => {
    const newErrors: Record<string, string> = {};

    if (!state.name.trim()) newErrors.name = "Name is required";
    if (!state.problemToSolve.trim()) newErrors.problemToSolve = "Problem to solve is required";
    if (!state.solutionOverview.trim()) newErrors.solutionOverview = "Solution overview is required";
    if (!state.complexity) newErrors.complexity = "Complexity is required";
    if (!state.processId) newErrors.processId = "Process is required";

    return newErrors;
  };

  const handleChange = (key: keyof UseCasePayload, value: string | number | null) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationErrors = validate(formState);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    const payload: UseCasePayload = {
      ...formState,
      estimatedFTEHours:
        formState.estimatedFTEHours === null || formState.estimatedFTEHours === undefined
          ? null
          : Number(formState.estimatedFTEHours)
    };

    if (selectedUseCase) {
      updateMutation.mutate({ id: selectedUseCase.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSubmitting = useMemo(
    () => createMutation.isPending || updateMutation.isPending,
    [createMutation.isPending, updateMutation.isPending]
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{selectedUseCase ? "Edit use case" : "Create a new use case"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formState.name}
                onChange={(event) => handleChange("name", event.target.value)}
                placeholder="Summarize the use case"
              />
              {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="processId">Process</Label>
              <select
                id="processId"
                value={formState.processId}
                onChange={(event) => handleChange("processId", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a process</option>
                {processes.map((process) => (
                  <option key={process.id} value={process.id}>
                    {process.name}
                  </option>
                ))}
              </select>
              {errors.processId ? <p className="text-sm text-destructive">{errors.processId}</p> : null}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="problemToSolve">Problem to solve</Label>
              <Textarea
                id="problemToSolve"
                value={formState.problemToSolve}
                onChange={(event) => handleChange("problemToSolve", event.target.value)}
                placeholder="What challenge does this use case address?"
              />
              {errors.problemToSolve ? (
                <p className="text-sm text-destructive">{errors.problemToSolve}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="solutionOverview">Solution overview</Label>
              <Textarea
                id="solutionOverview"
                value={formState.solutionOverview}
                onChange={(event) => handleChange("solutionOverview", event.target.value)}
                placeholder="Outline the proposed AI solution"
              />
              {errors.solutionOverview ? (
                <p className="text-sm text-destructive">{errors.solutionOverview}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formState.description ?? ""}
                onChange={(event) => handleChange("description", event.target.value)}
                placeholder="Add any narrative details"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedBenefits">Expected benefits</Label>
              <Textarea
                id="expectedBenefits"
                value={formState.expectedBenefits ?? ""}
                onChange={(event) => handleChange("expectedBenefits", event.target.value)}
                placeholder="What outcomes are expected?"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="valueDrivers">Value drivers</Label>
              <Textarea
                id="valueDrivers"
                value={formState.valueDrivers ?? ""}
                onChange={(event) => handleChange("valueDrivers", event.target.value)}
                placeholder="Key levers that create value"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataRequirements">Data requirements</Label>
              <Textarea
                id="dataRequirements"
                value={formState.dataRequirements ?? ""}
                onChange={(event) => handleChange("dataRequirements", event.target.value)}
                placeholder="Data needed to deliver this use case"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="systemsImpacted">Systems impacted</Label>
              <Textarea
                id="systemsImpacted"
                value={formState.systemsImpacted ?? ""}
                onChange={(event) => handleChange("systemsImpacted", event.target.value)}
                placeholder="Downstream or upstream systems"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="risks">Risks</Label>
              <Textarea
                id="risks"
                value={formState.risks ?? ""}
                onChange={(event) => handleChange("risks", event.target.value)}
                placeholder="Potential risks or blockers"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="complexity">Complexity</Label>
              <select
                id="complexity"
                value={formState.complexity}
                onChange={(event) => handleChange("complexity", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {(["Low", "Medium", "High", "Very High"] as const).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              {errors.complexity ? <p className="text-sm text-destructive">{errors.complexity}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confidenceLevel">Confidence level</Label>
              <select
                id="confidenceLevel"
                value={formState.confidenceLevel ?? ""}
                onChange={(event) => handleChange("confidenceLevel", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select confidence</option>
                {(["Low", "Medium", "High"] as const).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedDeliveryTime">Estimated delivery time</Label>
              <select
                id="estimatedDeliveryTime"
                value={formState.estimatedDeliveryTime ?? ""}
                onChange={(event) => handleChange("estimatedDeliveryTime", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a timeframe</option>
                {(["Quick Win", "1 to 3 months", "3 to 6 months", "6 plus months"] as const).map(
                  (option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="estimatedFTEHours">Estimated FTE hours</Label>
              <Input
                id="estimatedFTEHours"
                type="number"
                min="0"
                value={formState.estimatedFTEHours ?? ""}
                onChange={(event) => handleChange("estimatedFTEHours", event.target.value ? Number(event.target.value) : null)}
                placeholder="e.g. 120"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costRange">Cost range</Label>
              <select
                id="costRange"
                value={formState.costRange ?? ""}
                onChange={(event) => handleChange("costRange", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select cost</option>
                {(["Low", "Medium", "High", "Very High"] as const).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roiEstimate">ROI estimate</Label>
              <Input
                id="roiEstimate"
                value={formState.roiEstimate ?? ""}
                onChange={(event) => handleChange("roiEstimate", event.target.value)}
                placeholder="e.g. 120% or $250k"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : selectedUseCase ? "Update use case" : "Create use case"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
