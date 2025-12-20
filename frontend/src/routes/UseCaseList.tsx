import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { deleteUseCase, getUseCases } from "@/api/useCases";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UseCaseForm } from "@/components/UseCaseForm";
import { UseCaseList as UseCaseGrid } from "@/components/UseCaseList";
import { FilterByContext } from "@/components/FilterByContext";
import { LinkManagerModal } from "@/components/LinkManagerModal";
import { useFilterStore } from "../stores/filterStore";
import type { UseCase } from "@/types/useCase";
import type { BusinessUnit } from "@/types/business";

interface Process {
  id: string;
  businessUnitId: string;
}

const API_URL = import.meta.env.VITE_API_URL || "";

export default function UseCaseListPage() {
  const queryClient = useQueryClient();
  const {
    selectedCompanyId,
    selectedBusinessUnitId,
    selectedProcessId: contextProcessId,
  } = useFilterStore();
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedUseCaseForLink, setSelectedUseCaseForLink] = useState<UseCase | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    processId: "",
    complexity: "",
    confidenceLevel: ""
  });

  const { data: useCaseLinkStats = {} } = useQuery<Record<string, number>>({
    queryKey: ["useCaseLinkStats"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/pain-point-links/all`);
      const links = response.data as Array<{ useCaseId: string }>;
      const stats: Record<string, number> = {};
      links.forEach(link => {
        if (link.useCaseId) {
          stats[link.useCaseId] = (stats[link.useCaseId] || 0) + 1;
        }
      });
      return stats;
    }
  });

  const { data: useCaseAvgSolved = {} } = useQuery<Record<string, number>>({
    queryKey: ["useCaseAvgSolved"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/pain-point-links/all`);
      const links = response.data as Array<{ useCaseId: string; percentageSolved: number | null }>;
      const statsMap: Record<string, { sum: number; count: number }> = {};
      links.forEach(link => {
        if (link.useCaseId && link.percentageSolved !== null) {
          if (!statsMap[link.useCaseId]) {
            statsMap[link.useCaseId] = { sum: 0, count: 0 };
          }
          statsMap[link.useCaseId].sum += Number(link.percentageSolved);
          statsMap[link.useCaseId].count += 1;
        }
      });
      const avgStats: Record<string, number> = {};
      Object.entries(statsMap).forEach(([id, { sum, count }]) => {
        avgStats[id] = Math.round(sum / count);
      });
      return avgStats;
    }
  });

  const handleOpenLinkModal = (useCase: UseCase) => {
    setSelectedUseCaseForLink(useCase);
    setLinkModalOpen(true);
  };

  const { data: useCases = [], isLoading: useCasesLoading } = useQuery({
    queryKey: ["use-cases"],
    queryFn: getUseCases
  });

  const { data: processes = [] } = useQuery<Process[]>({
    queryKey: ["all-processes"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/processes`);
      return response.data;
    }
  });

  const { data: businessUnits = [] } = useQuery<BusinessUnit[]>({
    queryKey: ["all-business-units"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/business-units`);
      return response.data;
    }
  });

  const validProcessIds = useMemo(() => {
    if (contextProcessId) {
      return new Set([contextProcessId]);
    } else if (selectedBusinessUnitId) {
      return new Set(processes.filter(p => p.businessUnitId === selectedBusinessUnitId).map(p => p.id));
    } else if (selectedCompanyId) {
      const companyBuIds = new Set(businessUnits.filter(bu => bu.companyId === selectedCompanyId).map(bu => bu.id));
      return new Set(processes.filter(p => companyBuIds.has(p.businessUnitId)).map(p => p.id));
    }
    return null;
  }, [selectedCompanyId, selectedBusinessUnitId, contextProcessId, processes, businessUnits]);

  const validBusinessUnitIds = useMemo(() => {
    if (selectedBusinessUnitId) {
      return new Set([selectedBusinessUnitId]);
    } else if (selectedCompanyId) {
      return new Set(businessUnits.filter(bu => bu.companyId === selectedCompanyId).map(bu => bu.id));
    }
    return null;
  }, [selectedCompanyId, selectedBusinessUnitId, businessUnits]);

  const contextFilteredUseCases = useMemo(() => {
    if (!selectedCompanyId && !selectedBusinessUnitId && !contextProcessId) {
      return useCases;
    }
    
    return useCases.filter(uc => {
      if (contextProcessId) {
        return uc.processId === contextProcessId;
      }
      
      if (selectedBusinessUnitId) {
        return (
          uc.businessUnitId === selectedBusinessUnitId ||
          (uc.processId && validProcessIds?.has(uc.processId))
        );
      }
      
      if (selectedCompanyId) {
        return (
          uc.companyId === selectedCompanyId ||
          (uc.businessUnitId && validBusinessUnitIds?.has(uc.businessUnitId)) ||
          (uc.processId && validProcessIds?.has(uc.processId))
        );
      }
      
      return true;
    });
  }, [useCases, selectedCompanyId, selectedBusinessUnitId, contextProcessId, validProcessIds, validBusinessUnitIds]);

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
    const confirmed = window.confirm("Are you sure you want to delete this solution?");
    if (confirmed) {
      deleteMutation.mutate(id);
      if (selectedUseCase?.id === id) {
        setSelectedUseCase(null);
      }
    }
  };

  const handleNewUseCase = () => {
    setSelectedUseCase(null);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setSelectedUseCase(null);
    setShowForm(false);
  };

  const handleDialogChange = (open: boolean) => {
    setShowForm(open);
    if (!open) {
      setSelectedUseCase(null);
    }
  };

  const headerSubtitle = useMemo(() => {
    if (useCasesLoading) return "Loading solutions...";
    if (contextFilteredUseCases.length === 0) {
      if (validProcessIds) {
        return "No solutions match the current filter.";
      }
      return "Create your first solution to get started.";
    }
    return `${contextFilteredUseCases.length} solutions available`;
  }, [contextFilteredUseCases.length, useCasesLoading, validProcessIds]);

  return (
    <div className="space-y-4 sm:space-y-6 fade-in">
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Solutions</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Solutions Library</h1>
            <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
          </div>
          <Button onClick={handleNewUseCase} className="shrink-0">
            New Solution
          </Button>
        </div>
      </div>

      <FilterByContext />

      <UseCaseGrid
        useCases={contextFilteredUseCases}
        filters={filters}
        onFiltersChange={setFilters}
        onEdit={(useCase) => {
          setSelectedUseCase(useCase);
          setShowForm(true);
        }}
        onDelete={handleDelete}
        onLink={handleOpenLinkModal}
        linkStats={useCaseLinkStats}
        avgSolvedStats={useCaseAvgSolved}
        isLoading={useCasesLoading}
      />

      <Dialog open={showForm} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedUseCase ? "Edit Solution" : "Create New Solution"}</DialogTitle>
          </DialogHeader>
          <UseCaseForm
            selectedUseCase={selectedUseCase}
            onSuccess={handleFormSuccess}
          />
        </DialogContent>
      </Dialog>

      {selectedUseCaseForLink && (
        <LinkManagerModal
          open={linkModalOpen}
          onOpenChange={setLinkModalOpen}
          mode="use-case"
          sourceId={selectedUseCaseForLink.id}
          sourceName={selectedUseCaseForLink.name}
        />
      )}
    </div>
  );
}
