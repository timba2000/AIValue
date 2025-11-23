import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUseCase, updateUseCase } from "@/api/useCases";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UseCase, UseCasePayload, DataRequirement, RiskLevel } from "@/types/useCase";

interface UseCaseFormProps {
  selectedUseCase: UseCase | null;
  onSuccess: () => void;
}

const DATA_REQUIREMENT_OPTIONS: DataRequirement[] = ["Structured", "Unstructured"];
const RISK_LEVELS: RiskLevel[] = ["High", "Medium", "Low"];

const DEFAULT_STATE: UseCasePayload = {
  name: "",
  solutionProvider: null,
  problemToSolve: "",
  solutionOverview: "",
  expectedBenefits: null,
  complexity: "Medium",
  dataRequirements: null,
  systemsImpacted: null,
  risks: null,
  estimatedDeliveryTime: "Quick Win",
  costRange: "Medium",
  confidenceLevel: "Medium",
  processId: null
};

export function UseCaseForm({ selectedUseCase, onSuccess }: UseCaseFormProps) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<UseCasePayload>(DEFAULT_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedUseCase) {
      setFormState({
        name: selectedUseCase.name,
        solutionProvider: selectedUseCase.solutionProvider,
        problemToSolve: selectedUseCase.problemToSolve,
        solutionOverview: selectedUseCase.solutionOverview,
        expectedBenefits: selectedUseCase.expectedBenefits,
        complexity: selectedUseCase.complexity,
        dataRequirements: selectedUseCase.dataRequirements,
        systemsImpacted: selectedUseCase.systemsImpacted,
        risks: selectedUseCase.risks,
        estimatedDeliveryTime: selectedUseCase.estimatedDeliveryTime ?? "Quick Win",
        costRange: selectedUseCase.costRange ?? "Medium",
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
    
    if (state.expectedBenefits !== null && (state.expectedBenefits < 0 || state.expectedBenefits > 100)) {
      newErrors.expectedBenefits = "Expected benefits must be between 0 and 100";
    }

    return newErrors;
  };

  const handleChange = (key: keyof UseCasePayload, value: string | number | null | DataRequirement[]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleDataRequirementToggle = (requirement: DataRequirement) => {
    setFormState((prev) => {
      const current = prev.dataRequirements || [];
      const updated = current.includes(requirement)
        ? current.filter((r) => r !== requirement)
        : [...current, requirement];
      return { ...prev, dataRequirements: updated.length > 0 ? updated : null };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationErrors = validate(formState);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    const payload: UseCasePayload = {
      ...formState,
      expectedBenefits: formState.expectedBenefits !== null && formState.expectedBenefits !== undefined
        ? Number(formState.expectedBenefits)
        : null
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
              <Label htmlFor="solutionProvider">Solution Provider</Label>
              <Input
                id="solutionProvider"
                value={formState.solutionProvider ?? ""}
                onChange={(event) => handleChange("solutionProvider", event.target.value || null)}
                placeholder="e.g. OpenAI, Microsoft, Custom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedBenefits">
                Expected Benefits (%)
                <span className="ml-1 text-xs text-muted-foreground">0-100</span>
              </Label>
              <Input
                id="expectedBenefits"
                type="number"
                min="0"
                max="100"
                step="1"
                value={formState.expectedBenefits ?? ""}
                onChange={(event) => handleChange("expectedBenefits", event.target.value ? Number(event.target.value) : null)}
                placeholder="e.g. 25"
              />
              {errors.expectedBenefits ? (
                <p className="text-sm text-destructive">{errors.expectedBenefits}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data Requirements</Label>
              <div className="flex gap-4 pt-2">
                {DATA_REQUIREMENT_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.dataRequirements?.includes(option) ?? false}
                      onChange={() => handleDataRequirementToggle(option)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="systemsImpacted">
                Systems Impacted
                <span className="ml-1 text-xs text-muted-foreground">Comma separated</span>
              </Label>
              <Input
                id="systemsImpacted"
                value={formState.systemsImpacted ?? ""}
                onChange={(event) => handleChange("systemsImpacted", event.target.value || null)}
                placeholder="e.g. SAP, Salesforce, Oracle"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="risks">Risks</Label>
              <select
                id="risks"
                value={formState.risks ?? ""}
                onChange={(event) => handleChange("risks", event.target.value ? event.target.value as RiskLevel : null)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select risk level</option>
                {RISK_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
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
          </div>

          <div className="grid gap-6 md:grid-cols-2">
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
