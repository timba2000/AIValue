import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProcessRecord } from "@/types/process";
import type { UseCase } from "@/types/useCase";

interface UseCaseFilters {
  search: string;
  processId: string;
  complexity: string;
  confidenceLevel: string;
}

interface UseCaseListProps {
  useCases: UseCase[];
  processes: ProcessRecord[];
  filters: UseCaseFilters;
  onFiltersChange: (filters: UseCaseFilters) => void;
  onEdit: (useCase: UseCase) => void;
  onDelete: (useCaseId: string) => void;
  isLoading: boolean;
}

export function UseCaseList({
  useCases,
  processes,
  filters,
  onFiltersChange,
  onEdit,
  onDelete,
  isLoading
}: UseCaseListProps) {
  const filtered = useMemo(() => {
    return useCases.filter((useCase) => {
      const matchesSearch = useCase.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchesProcess = filters.processId ? useCase.processId === filters.processId : true;
      const matchesComplexity = filters.complexity ? useCase.complexity === filters.complexity : true;
      const matchesConfidence = filters.confidenceLevel
        ? useCase.confidenceLevel === filters.confidenceLevel
        : true;

      return matchesSearch && matchesProcess && matchesComplexity && matchesConfidence;
    });
  }, [filters, useCases]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, UseCase[]>>((acc, useCase) => {
      const groupKey = useCase.processName ?? "Unassigned";
      acc[groupKey] = acc[groupKey] ? [...acc[groupKey], useCase] : [useCase];
      return acc;
    }, {});
  }, [filtered]);

  const handleFilterChange = (key: keyof UseCaseFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search by name"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="processFilter">Process</Label>
            <select
              id="processFilter"
              value={filters.processId}
              onChange={(event) => handleFilterChange("processId", event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All processes</option>
              {processes.map((process) => (
                <option key={process.id} value={process.id}>
                  {process.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="complexityFilter">Complexity</Label>
            <select
              id="complexityFilter"
              value={filters.complexity}
              onChange={(event) => handleFilterChange("complexity", event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All</option>
              {(["Low", "Medium", "High", "Very High"] as const).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confidenceFilter">Confidence level</Label>
            <select
              id="confidenceFilter"
              value={filters.confidenceLevel}
              onChange={(event) => handleFilterChange("confidenceLevel", event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All</option>
              {(["Low", "Medium", "High"] as const).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading use cases...</p> : null}
        {Object.keys(grouped).length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">No use cases match the current filters.</p>
        ) : null}

        {Object.entries(grouped).map(([processName, items]) => (
          <div key={processName} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Process</p>
                <h3 className="text-lg font-semibold">{processName}</h3>
              </div>
              <span className="text-sm text-muted-foreground">{items.length} use cases</span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Process</TableHead>
                    <TableHead>Complexity</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>ROI Estimate</TableHead>
                    <TableHead>Delivery Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {items.map((useCase) => (
                      <TableRow key={useCase.id} className="hover:bg-muted/40">
                        <TableCell className="font-medium">{useCase.name}</TableCell>
                        <TableCell>{useCase.processName ?? "-"}</TableCell>
                        <TableCell>{useCase.complexity}</TableCell>
                        <TableCell>{useCase.confidenceLevel ?? "-"}</TableCell>
                        <TableCell>{useCase.roiEstimate ?? "-"}</TableCell>
                        <TableCell>{useCase.estimatedDeliveryTime ?? "-"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => onEdit(useCase)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            onClick={() => onDelete(useCase.id)}
                          >
                            Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
