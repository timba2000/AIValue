import { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FilterByContext } from "@/components/FilterByContext";
import { LinkManagerModal } from "@/components/LinkManagerModal";
import { PainPointMetricsCards } from "@/components/PainPointMetricsCards";
import { PainPointsOverviewTable } from "@/components/dashboard/PainPointsOverviewTable";
import { PainPointEditModal } from "@/components/PainPointEditModal";
import { useFilterStore } from "../stores/filterStore";
import { useAllBusinessUnits, useAllProcesses, useBusinessUnitsFlat } from "../hooks/useApiData";
import { getDescendantIds } from "../utils/hierarchy";
import type { PainPoint } from "@/types/painPoint";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface TaxonomyCategory {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
}

function parseProcessHierarchy(name: string): { l1: string; l2: string; l3: string } {
  let nameParts: string[] = [];
  if (name.includes(" > ")) {
    nameParts = name.split(" > ");
  } else if (name.includes(" - ")) {
    nameParts = name.split(" - ");
  } else if (name.includes("/")) {
    nameParts = name.split("/");
  }
  return {
    l1: nameParts[0]?.trim() || "-",
    l2: nameParts[1]?.trim() || "-",
    l3: nameParts[2]?.trim() || "-"
  };
}

export default function PainPointList() {
  const {
    selectedCompanyId,
    selectedBusinessUnitId,
    selectedProcessId,
    selectedL1Process,
    selectedL2Process,
    painPointFilter,
  } = useFilterStore();
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPainPointId, setEditingPainPointId] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedPainPointForLink, setSelectedPainPointForLink] = useState<PainPoint | null>(null);

  const { data: businessUnits = [] } = useAllBusinessUnits();
  const { data: processes = [] } = useAllProcesses();
  const { data: businessUnitsHierarchy = [] } = useBusinessUnitsFlat(selectedCompanyId);

  const { data: painPoints = [], isLoading: loading, refetch: refetchPainPoints, error: painPointsError } = useQuery<PainPoint[]>({
    queryKey: ["painPoints"],
    queryFn: async () => {
      const response = await axios.get<PainPoint[]>(`${API_BASE}/api/pain-points`);
      return response.data;
    }
  });

  const { data: linkStats = {} } = useQuery<Record<string, number>>({
    queryKey: ["allPainPointLinksStats"],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/api/pain-point-links/stats`);
      return response.data;
    }
  });

  const { data: allLinks = [] } = useQuery<Array<{
    id: string;
    painPointId: string;
    useCaseId: string;
    useCaseName: string | null;
    percentageSolved: number | null;
    notes: string | null;
    processIds: string[];
  }>>({
    queryKey: ["allPainPointLinksDetails"],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/api/pain-point-links/details`);
      return response.data;
    }
  });

  const { data: taxonomyCategories = [] } = useQuery<TaxonomyCategory[]>({
    queryKey: ["taxonomyCategories"],
    queryFn: async () => {
      const response = await axios.get<TaxonomyCategory[]>(`${API_BASE}/api/taxonomy`);
      return response.data;
    }
  });

  useEffect(() => {
    if (painPointsError) {
      setError("Failed to load pain points");
    }
  }, [painPointsError]);

  const handleOpenLinkModal = (painPoint: PainPoint) => {
    setSelectedPainPointForLink(painPoint);
    setLinkModalOpen(true);
  };

  const validProcessIds = useMemo(() => {
    if (selectedProcessId) {
      return new Set([selectedProcessId]);
    }
    
    let filteredProcesses = processes;
    
    if (selectedBusinessUnitId) {
      const descendantIds = getDescendantIds(businessUnitsHierarchy, selectedBusinessUnitId);
      const allUnitIds = new Set([selectedBusinessUnitId, ...descendantIds]);
      filteredProcesses = filteredProcesses.filter(p => allUnitIds.has(p.businessUnitId));
    } else if (selectedCompanyId) {
      const companyBuIds = new Set(businessUnits.filter(bu => bu.companyId === selectedCompanyId).map(bu => bu.id));
      filteredProcesses = filteredProcesses.filter(p => companyBuIds.has(p.businessUnitId));
    }
    
    if (selectedL1Process) {
      filteredProcesses = filteredProcesses.filter(p => {
        const { l1 } = parseProcessHierarchy(p.name);
        return l1 === selectedL1Process;
      });
    }
    
    if (selectedL2Process) {
      filteredProcesses = filteredProcesses.filter(p => {
        const { l2 } = parseProcessHierarchy(p.name);
        return l2 === selectedL2Process;
      });
    }
    
    if (filteredProcesses.length < processes.length || selectedL1Process || selectedL2Process) {
      return new Set(filteredProcesses.map(p => p.id));
    }
    
    return null;
  }, [selectedCompanyId, selectedBusinessUnitId, selectedProcessId, selectedL1Process, selectedL2Process, processes, businessUnits, businessUnitsHierarchy]);

  const validBusinessUnitIds = useMemo(() => {
    if (selectedBusinessUnitId) {
      const descendantIds = getDescendantIds(businessUnitsHierarchy, selectedBusinessUnitId);
      return new Set([selectedBusinessUnitId, ...descendantIds]);
    } else if (selectedCompanyId) {
      return new Set(businessUnits.filter(bu => bu.companyId === selectedCompanyId).map(bu => bu.id));
    }
    return null;
  }, [selectedCompanyId, selectedBusinessUnitId, businessUnits, businessUnitsHierarchy]);

  const filteredPainPoints = useMemo(() => {
    let filtered = painPoints;
    
    const hasProcessFilter = validProcessIds && validProcessIds.size > 0;
    const hasBusinessUnitFilter = validBusinessUnitIds && validBusinessUnitIds.size > 0;
    
    if (hasProcessFilter || hasBusinessUnitFilter) {
      filtered = filtered.filter(pp => {
        const matchesProcess = hasProcessFilter && pp.processIds && pp.processIds.some(id => validProcessIds.has(id));
        const matchesDirectBU = hasBusinessUnitFilter && pp.businessUnitId && validBusinessUnitIds.has(pp.businessUnitId);
        return matchesProcess || matchesDirectBU;
      });
    }

    if (painPointFilter === "linked") {
      filtered = filtered.filter(pp => linkStats[pp.id] && linkStats[pp.id] > 0);
    } else if (painPointFilter === "unlinked") {
      filtered = filtered.filter(pp => !linkStats[pp.id] || linkStats[pp.id] === 0);
    }
    
    return filtered;
  }, [painPoints, validProcessIds, validBusinessUnitIds, painPointFilter, linkStats]);

  const metricsData = useMemo(() => {
    const linkedCount = filteredPainPoints.filter(pp => 
      linkStats[pp.id] && linkStats[pp.id] > 0).length;
    const unlinkedCount = filteredPainPoints.length - linkedCount;

    const getL1Name = (l1Id: string | null | undefined) => {
      if (!l1Id) return null;
      const category = taxonomyCategories.find(c => c.id === l1Id);
      return category?.name?.toLowerCase() || null;
    };

    let peopleCount = 0;
    let processCount = 0;
    let technologyCount = 0;

    filteredPainPoints.forEach(pp => {
      const l1Name = getL1Name(pp.taxonomyLevel1Id);
      if (l1Name?.includes('people')) peopleCount++;
      else if (l1Name?.includes('process')) processCount++;
      else if (l1Name?.includes('technology') || l1Name?.includes('tech')) technologyCount++;
    });

    const total = filteredPainPoints.length;
    const peoplePercent = total > 0 ? Math.round((peopleCount / total) * 100) : 0;
    const processPercent = total > 0 ? Math.round((processCount / total) * 100) : 0;
    const technologyPercent = total > 0 ? Math.round((technologyCount / total) * 100) : 0;

    return {
      totalPainPoints: filteredPainPoints.length,
      linkedCount,
      unlinkedCount,
      peopleCount,
      peoplePercent,
      processCount,
      processPercent,
      technologyCount,
      technologyPercent
    };
  }, [filteredPainPoints, linkStats, taxonomyCategories]);

  const overviewTableData = useMemo(() => {
    return filteredPainPoints.map(pp => {
      const ppLinks = allLinks.filter(link => link.painPointId === pp.id);
      const totalPercentageSolved = ppLinks.reduce((sum, link) => sum + (link.percentageSolved ? Number(link.percentageSolved) : 0), 0);
      const cappedPercentage = Math.min(totalPercentageSolved, 100);
      const potentialHoursSaved = Number(pp.totalHoursPerMonth || 0) * (cappedPercentage / 100);
      
      return {
        id: pp.id,
        statement: pp.statement,
        magnitude: Number(pp.magnitude || 0),
        effortSolving: Number(pp.effortSolving || 0),
        totalHoursPerMonth: Number(pp.totalHoursPerMonth || 0),
        fteCount: Number(pp.fteCount || 0),
        hasLinks: ppLinks.length > 0,
        linkedSolutions: ppLinks.map(link => link.useCaseName).filter((name): name is string => name !== null),
        totalPercentageSolved,
        potentialHoursSaved: Math.round(potentialHoursSaved)
      };
    }).sort((a, b) => {
      const effortA = a.effortSolving === 0 ? 0.1 : (a.effortSolving || 10);
      const effortB = b.effortSolving === 0 ? 0.1 : (b.effortSolving || 10);
      const ratioA = a.magnitude / effortA;
      const ratioB = b.magnitude / effortB;
      return ratioB - ratioA;
    });
  }, [filteredPainPoints, allLinks]);

  const handleCreate = () => {
    setEditingPainPointId(null);
    setEditModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pain point?")) return;

    try {
      await axios.delete(`${API_BASE}/api/pain-points/${id}`);
      await refetchPainPoints();
    } catch {
      setError("Failed to delete pain point");
    }
  };

  return (
    <section className="space-y-4 sm:space-y-6 fade-in">
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Pain Points</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Identify and track process pain points across your organization
            </p>
          </div>
          <Button onClick={handleCreate} className="shrink-0">
            New pain point
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <PainPointMetricsCards
        totalPainPoints={metricsData.totalPainPoints}
        linkedCount={metricsData.linkedCount}
        unlinkedCount={metricsData.unlinkedCount}
        peopleCount={metricsData.peopleCount}
        peoplePercent={metricsData.peoplePercent}
        processCount={metricsData.processCount}
        processPercent={metricsData.processPercent}
        technologyCount={metricsData.technologyCount}
        technologyPercent={metricsData.technologyPercent}
      />

      <FilterByContext />

      <PainPointsOverviewTable
        data={overviewTableData}
        isLoading={loading && painPoints.length === 0}
        onManageClick={(painPointId) => {
          const pp = painPoints.find(p => p.id === painPointId);
          if (pp) handleOpenLinkModal(pp);
        }}
        onEditClick={(painPointId) => {
          setEditingPainPointId(painPointId);
          setEditModalOpen(true);
        }}
        onDeleteClick={handleDelete}
      />

      <PainPointEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        painPointId={editingPainPointId}
        onSaveSuccess={() => {
          refetchPainPoints();
        }}
      />

      {selectedPainPointForLink && (
        <LinkManagerModal
          open={linkModalOpen}
          onOpenChange={setLinkModalOpen}
          mode="pain-point"
          sourceId={selectedPainPointForLink.id}
          sourceName={selectedPainPointForLink.statement}
        />
      )}
    </section>
  );
}
