import { useEffect, useMemo, useRef, useState } from "react";
import { useUseCaseStore } from "@/store/useCases";
import type { UseCase } from "@/types/useCase";

type ClassificationKey = "industry" | "pattern" | "automationLevel";

const buildClassifierOptions = (key: ClassificationKey, items: UseCase[]) => {
  const values = new Set<string>();
  let hasUnclassified = false;

  for (const item of items) {
    const value = item[key];
    if (value) {
      values.add(value);
    } else {
      hasUnclassified = true;
    }
  }

  return {
    values: Array.from(values).sort((a, b) => a.localeCompare(b)),
    hasUnclassified
  };
};

export function UseCaseTable() {
  const useCases = useUseCaseStore((state) => state.useCases);
  const fetchUseCases = useUseCaseStore((state) => state.fetchUseCases);
  const loading = useUseCaseStore((state) => state.loading);
  const hasLoaded = useRef(false);
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [patternFilter, setPatternFilter] = useState<string>("all");
  const [automationFilter, setAutomationFilter] = useState<string>("all");
  const [minConfidence, setMinConfidence] = useState<string>("");

  const industryOptions = useMemo(
    () => buildClassifierOptions("industry", useCases),
    [useCases]
  );
  const patternOptions = useMemo(
    () => buildClassifierOptions("pattern", useCases),
    [useCases]
  );
  const automationOptions = useMemo(
    () => buildClassifierOptions("automationLevel", useCases),
    [useCases]
  );

  const minConfidenceValue = useMemo(() => {
    if (minConfidence.trim() === "") {
      return null;
    }

    const parsed = Number(minConfidence);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    const clamped = Math.min(Math.max(parsed, 0), 100);
    return clamped / 100;
  }, [minConfidence]);

  const filteredUseCases = useMemo(() => {
    return useCases.filter((useCase) => {
      const matchesIndustry =
        industryFilter === "all"
          ? true
          : industryFilter === "unclassified"
            ? !useCase.industry
            : useCase.industry === industryFilter;

      const matchesPattern =
        patternFilter === "all"
          ? true
          : patternFilter === "unclassified"
            ? !useCase.pattern
            : useCase.pattern === patternFilter;

      const matchesAutomation =
        automationFilter === "all"
          ? true
          : automationFilter === "unclassified"
            ? !useCase.automationLevel
            : useCase.automationLevel === automationFilter;

      const confidence = useCase.classificationConfidence;
      const matchesConfidence =
        minConfidenceValue === null
          ? true
          : confidence !== null && Number.isFinite(confidence) && confidence >= minConfidenceValue;

      return matchesIndustry && matchesPattern && matchesAutomation && matchesConfidence;
    });
  }, [
    automationFilter,
    industryFilter,
    minConfidenceValue,
    patternFilter,
    useCases
  ]);

  const sortedUseCases = useMemo(() => {
    return [...filteredUseCases].sort((a, b) => {
      if (a.valueScore === b.valueScore) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return b.valueScore - a.valueScore;
    });
  }, [filteredUseCases]);

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    });
  }, []);

  const formatConfidence = (confidence: number | null) => {
    if (confidence === null) {
      return "—";
    }

    if (!Number.isFinite(confidence)) {
      return "—";
    }

    return `${(confidence * 100).toFixed(1)}%`;
  };

  useEffect(() => {
    if (hasLoaded.current) {
      return;
    }
    hasLoaded.current = true;
    void fetchUseCases();
  }, [fetchUseCases]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-lg border bg-card/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted-foreground">Industry</span>
          <select
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={industryFilter}
            onChange={(event) => setIndustryFilter(event.target.value)}
          >
            <option value="all">All industries</option>
            {industryOptions.values.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            {industryOptions.hasUnclassified ? (
              <option value="unclassified">Unclassified</option>
            ) : null}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted-foreground">Pattern</span>
          <select
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={patternFilter}
            onChange={(event) => setPatternFilter(event.target.value)}
          >
            <option value="all">All patterns</option>
            {patternOptions.values.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            {patternOptions.hasUnclassified ? (
              <option value="unclassified">Unclassified</option>
            ) : null}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted-foreground">Automation Level</span>
          <select
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={automationFilter}
            onChange={(event) => setAutomationFilter(event.target.value)}
          >
            <option value="all">All levels</option>
            {automationOptions.values.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            {automationOptions.hasUnclassified ? (
              <option value="unclassified">Unclassified</option>
            ) : null}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase text-muted-foreground">Min. Confidence (%)</span>
          <input
            className="rounded-md border bg-background px-2 py-1 text-sm"
            type="number"
            min={0}
            max={100}
            step={1}
            value={minConfidence}
            onChange={(event) => setMinConfidence(event.target.value)}
            placeholder="Any"
          />
        </label>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Title
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Problem
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Industry
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Pattern
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Automation Level
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Confidence
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Value
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
        <tbody className="divide-y divide-border bg-card/40">
          {filteredUseCases.length === 0 && !loading ? (
            <tr>
              <td colSpan={8} className="px-6 py-4 text-center text-sm text-muted-foreground">
                {useCases.length === 0
                  ? "No use cases yet. Add one above!"
                  : "No use cases match the selected filters."}
              </td>
            </tr>
          ) : (
            sortedUseCases.map((useCase) => (
              <tr key={useCase.id} className="hover:bg-muted/50">
                <td className="px-6 py-4 text-sm font-medium text-foreground">{useCase.title}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  <p className="max-w-3xl whitespace-pre-wrap">{useCase.problem}</p>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {useCase.industry ?? "—"}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {useCase.pattern ?? "—"}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {useCase.automationLevel ?? "—"}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{formatConfidence(useCase.classificationConfidence)}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {currencyFormatter.format(useCase.valueScore)}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {new Date(useCase.createdAt).toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
