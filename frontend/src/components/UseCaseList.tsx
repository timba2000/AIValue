import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link2, Check, AlertCircle } from "lucide-react";
import type { UseCase } from "@/types/useCase";

interface UseCaseFilters {
  search: string;
  processId: string;
  complexity: string;
  confidenceLevel: string;
}

interface UseCaseListProps {
  useCases: UseCase[];
  filters: UseCaseFilters;
  onFiltersChange: (filters: UseCaseFilters) => void;
  onEdit: (useCase: UseCase) => void;
  onDelete: (useCaseId: string) => void;
  onLink?: (useCase: UseCase) => void;
  linkStats?: Record<string, number>;
  isLoading: boolean;
}

export function UseCaseList({
  useCases,
  filters,
  onFiltersChange,
  onEdit,
  onDelete,
  onLink,
  linkStats = {},
  isLoading
}: UseCaseListProps) {
  const filtered = useMemo(() => {
    return useCases.filter((useCase) => {
      const matchesSearch = useCase.name.toLowerCase().includes(filters.search.toLowerCase());
      const matchesComplexity = filters.complexity ? useCase.complexity === filters.complexity : true;
      const matchesConfidence = filters.confidenceLevel
        ? useCase.confidenceLevel === filters.confidenceLevel
        : true;

      return matchesSearch && matchesComplexity && matchesConfidence;
    });
  }, [filters, useCases]);

  const handleFilterChange = (key: keyof UseCaseFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
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

      <div className="space-y-4">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading use cases...</p> : null}
        {filtered.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">No use cases match the current filters.</p>
        ) : null}

        {filtered.length > 0 && !isLoading ? (
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Solution Provider</TableHead>
                    <TableHead>Complexity</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Expected Benefits (%)</TableHead>
                    <TableHead>Delivery Time</TableHead>
                    <TableHead className="text-center">Linked Pain Points</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((useCase) => (
                    <TableRow key={useCase.id} className="hover:bg-muted/40">
                      <TableCell className="font-medium">{useCase.name}</TableCell>
                      <TableCell>{useCase.solutionProvider ?? "-"}</TableCell>
                      <TableCell>{useCase.complexity}</TableCell>
                      <TableCell>{useCase.confidenceLevel ?? "-"}</TableCell>
                      <TableCell>{useCase.expectedBenefits !== null ? `${useCase.expectedBenefits}%` : "-"}</TableCell>
                      <TableCell>{useCase.estimatedDeliveryTime ?? "-"}</TableCell>
                      <TableCell className="text-center">
                        {linkStats[useCase.id] && linkStats[useCase.id] > 0 ? (
                          <button
                            onClick={() => onLink?.(useCase)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-xs font-medium"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {linkStats[useCase.id]} linked
                          </button>
                        ) : (
                          <button
                            onClick={() => onLink?.(useCase)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors text-xs font-medium border border-amber-200"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            Not linked
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onLink?.(useCase)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="Link pain points"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            Link
                          </button>
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
