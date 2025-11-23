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
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Use cases</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">AI Use Case Library</h1>
            <p className="text-sm text-gray-600">{headerSubtitle}</p>
          </div>
          <Button onClick={() => setSelectedUseCase(null)} className="shrink-0">
            New Usecase
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1fr_auto]">
        <div className="space-y-6 min-w-0">
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

        <div className="xl:w-[420px] xl:sticky xl:top-6 xl:self-start hidden xl:block">
          <UseCaseForm
            selectedUseCase={selectedUseCase}
            processes={processes}
            onSuccess={() => setSelectedUseCase(null)}
          />
        </div>
      </div>

      <Button
        className="fixed bottom-6 right-6 shadow-lg xl:hidden z-50"
        onClick={() => setSelectedUseCase(null)}
      >
        Add Use Case
      </Button>
    </div>
  );
}
