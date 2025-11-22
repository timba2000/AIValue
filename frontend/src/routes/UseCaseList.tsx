import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteUseCase, getUseCases } from "@/api/useCases";
import { getProcesses } from "@/api/processes";
import { Button } from "@/components/ui/button";
import { UseCaseForm } from "@/components/UseCaseForm";
import { UseCaseList as UseCaseGrid } from "@/components/UseCaseList";
import type { UseCase } from "@/types/useCase";

export default function UseCaseListPage() {
  const queryClient = useQueryClient();
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    processId: "",
    complexity: "",
    confidenceLevel: ""
  });

  const { data: useCases = [], isLoading: useCasesLoading } = useQuery({
    queryKey: ["use-cases"],
    queryFn: getUseCases
  });

  const { data: processes = [] } = useQuery({
    queryKey: ["processes"],
    queryFn: getProcesses
  });

  const deleteMutation = useMutation<void, unknown, string, { previous?: UseCase[] }>({
    mutationFn: deleteUseCase,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["use-cases"] });
      const previous = queryClient.getQueryData<UseCase[]>(["use-cases"]);
      if (previous) {
        queryClient.setQueryData(
          ["use-cases"],
          previous.filter((useCase: UseCase) => useCase.id !== id)
        );
      }
      return { previous };
    },
    onError: (_error: unknown, _variables: string, context?: { previous?: UseCase[] }) => {
      if (context?.previous) {
        queryClient.setQueryData(["use-cases"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["use-cases"] });
    }
  });

  const handleDelete = (id: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this use case?");
    if (confirmed) {
      deleteMutation.mutate(id);
      if (selectedUseCase?.id === id) {
        setSelectedUseCase(null);
      }
    }
  };

  const headerSubtitle = useMemo(() => {
    if (useCasesLoading) return "Loading use cases...";
    if (useCases.length === 0) return "Create your first use case to get started.";
    return `${useCases.length} use cases available`;
  }, [useCases.length, useCasesLoading]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Use cases</p>
        <h1 className="text-3xl font-bold tracking-tight">AI Use Case Library</h1>
        <p className="text-muted-foreground">{headerSubtitle}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_minmax(380px,0.9fr)]">
        <div className="space-y-6">
          <UseCaseGrid
            useCases={useCases}
            processes={processes}
            filters={filters}
            onFiltersChange={setFilters}
            onEdit={setSelectedUseCase}
            onDelete={handleDelete}
            isLoading={useCasesLoading}
          />
        </div>

        <div className="relative">
          <UseCaseForm
            selectedUseCase={selectedUseCase}
            processes={processes}
            onSuccess={() => setSelectedUseCase(null)}
          />
        </div>
      </div>

      <Button
        className="fixed bottom-6 right-6 shadow-lg"
        onClick={() => setSelectedUseCase(null)}
      >
        Add Use Case
      </Button>
    </div>
  );
}
