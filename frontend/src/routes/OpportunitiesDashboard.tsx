import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertTriangle, Pencil, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MetricsCards } from "@/components/dashboard/MetricsCards";
import { PrioritizationMatrix } from "@/components/dashboard/PrioritizationMatrix";
import { LinkedPainPointsTable } from "@/components/dashboard/LinkedPainPointsTable";
import { FilterByContext } from "@/components/FilterByContext";
import { useFilterStore } from "../stores/filterStore";

const API_URL = import.meta.env.VITE_API_URL || "";

interface Company {
  id: string;
  name: string;
}

interface BusinessUnit {
  id: string;
  companyId: string;
  name: string;
}

interface Process {
  id: string;
  businessId: string;
  businessUnitId: string;
  name: string;
}

interface PainPoint {
  id: string;
  statement: string;
  impactType: string[];
  magnitude: number | null;
  frequency: number | null;
  timePerUnit: number | null;
  totalHoursPerMonth: number | null;
  fteCount: number | null;
  riskLevel: string | null;
  effortSolving: number | null;
  processIds: string[];
}

interface UseCase {
  id: string;
  name: string;
  complexity: string;
  confidenceLevel: string;
}

interface PainPointLink {
  id: string;
  useCaseId: string;
  useCaseName: string;
  percentageSolved: number | null;
  notes: string | null;
}

export default function OpportunitiesDashboard() {
  const queryClient = useQueryClient();
  const {
    selectedCompanyId,
    selectedBusinessUnitId,
    selectedProcessId,
  } = useFilterStore();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedPainPoint, setSelectedPainPoint] = useState<PainPoint | null>(null);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState("");
  const [percentageSolved, setPercentageSolved] = useState("");
  const [notes, setNotes] = useState("");
  const [editingLink, setEditingLink] = useState<PainPointLink | null>(null);

  const { data: selectedPainPointLinks = [] } = useQuery<PainPointLink[]>({
    queryKey: ["painPointLinks", selectedPainPoint?.id],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/pain-points/${selectedPainPoint!.id}/links`);
      return response.data;
    },
    enabled: !!selectedPainPoint?.id && linkModalOpen
  });

  const totalAllocatedPercentage = useMemo(() => {
    return selectedPainPointLinks.reduce((sum, link) => {
      if (editingLink && link.id === editingLink.id) return sum;
      return sum + (link.percentageSolved ? Number(link.percentageSolved) : 0);
    }, 0);
  }, [selectedPainPointLinks, editingLink]);

  const remainingPercentage = Math.max(0, 100 - totalAllocatedPercentage);
  const isOverAllocated = totalAllocatedPercentage > 100;

  const isPercentageValid = useMemo(() => {
    if (!percentageSolved) return true;
    const value = Number(percentageSolved);
    if (value < 0) return false;
    return value <= remainingPercentage;
  }, [percentageSolved, remainingPercentage]);

  const canSubmit = useMemo(() => {
    if (!isPercentageValid) return false;
    if (!editingLink && isOverAllocated) return false;
    return true;
  }, [isPercentageValid, editingLink, isOverAllocated]);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/companies`);
      return response.data;
    }
  });

  const { data: businessUnits = [], isLoading: businessUnitsLoading } = useQuery<BusinessUnit[]>({
    queryKey: ["businessUnits", selectedCompanyId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/business-units`);
      return response.data.filter((bu: BusinessUnit) => bu.companyId === selectedCompanyId);
    },
    enabled: !!selectedCompanyId
  });

  const { data: processes = [], isLoading: processesLoading } = useQuery<Process[]>({
    queryKey: ["processes", selectedBusinessUnitId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/processes`);
      return response.data.filter(
        (p: Process) => p.businessUnitId === selectedBusinessUnitId
      );
    },
    enabled: !!selectedBusinessUnitId
  });

  // Get all processes for the company (used for filtering Process Links metric)
  const { data: companyProcesses = [], isLoading: companyProcessesLoading } = useQuery<Process[]>({
    queryKey: ["companyProcesses", selectedCompanyId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/processes`);
      return response.data;
    },
    enabled: !!selectedCompanyId
  });

  const { data: useCases = [] } = useQuery<UseCase[]>({
    queryKey: ["useCases"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/use-cases`);
      return response.data;
    }
  });

  const createLinkMutation = useMutation({
    mutationFn: async (data: {
      painPointId: string;
      useCaseId: string;
      percentageSolved: number | null;
      notes: string | null;
    }) => {
      const response = await axios.post(
        `${API_URL}/api/pain-points/${data.painPointId}/links`,
        {
          useCaseId: data.useCaseId,
          percentageSolved: data.percentageSolved,
          notes: data.notes
        }
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["painPointLinks", variables.painPointId] });
      queryClient.invalidateQueries({ queryKey: ["allPainPoints"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksStats"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksDetails"] });
      setLinkModalOpen(false);
      resetLinkForm();
    }
  });

  const updateLinkMutation = useMutation({
    mutationFn: async (data: {
      painPointId: string;
      linkId: string;
      percentageSolved: number | null;
      notes: string | null;
    }) => {
      const response = await axios.put(
        `${API_URL}/api/pain-points/${data.painPointId}/links/${data.linkId}`,
        {
          percentageSolved: data.percentageSolved,
          notes: data.notes
        }
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["painPointLinks", variables.painPointId] });
      queryClient.invalidateQueries({ queryKey: ["allPainPoints"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksStats"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksDetails"] });
      setLinkModalOpen(false);
      resetLinkForm();
    }
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (data: { painPointId: string; linkId: string }) => {
      await axios.delete(
        `${API_URL}/api/pain-points/${data.painPointId}/links/${data.linkId}`
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["painPointLinks", variables.painPointId] });
      queryClient.invalidateQueries({ queryKey: ["allPainPoints"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksStats"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksDetails"] });
    }
  });

  const resetLinkForm = () => {
    setSelectedUseCaseId("");
    setPercentageSolved("");
    setNotes("");
    setEditingLink(null);
  };

  const handleOpenLinkModal = (painPoint: PainPoint) => {
    setSelectedPainPoint(painPoint);
    setLinkModalOpen(true);
    resetLinkForm();
  };

  const handleEditLink = (link: PainPointLink) => {
    setEditingLink(link);
    setSelectedUseCaseId(link.useCaseId);
    setPercentageSolved(link.percentageSolved?.toString() || "");
    setNotes(link.notes || "");
  };

  const handleDeleteLink = (painPointId: string, linkId: string) => {
    if (confirm("Are you sure you want to remove this link?")) {
      deleteLinkMutation.mutate({ painPointId, linkId });
    }
  };

  const handleSubmitLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPainPoint) return;

    const percentValue = percentageSolved ? Number(percentageSolved) : null;

    if (editingLink) {
      updateLinkMutation.mutate({
        painPointId: selectedPainPoint.id,
        linkId: editingLink.id,
        percentageSolved: percentValue,
        notes: notes || null
      });
    } else {
      if (!selectedUseCaseId) return;
      createLinkMutation.mutate({
        painPointId: selectedPainPoint.id,
        useCaseId: selectedUseCaseId,
        percentageSolved: percentValue,
        notes: notes || null
      });
    }
  };

  const allPainPoints = useQuery<PainPoint[]>({
    queryKey: ["allPainPoints", selectedCompanyId, selectedBusinessUnitId, selectedProcessId],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (selectedCompanyId) {
        params.append('companyId', selectedCompanyId);
      }
      
      if (selectedBusinessUnitId) {
        params.append('businessUnitId', selectedBusinessUnitId);
      }
      
      if (selectedProcessId) {
        params.append('processIds', selectedProcessId);
      }
      
      const queryString = params.toString();
      const url = `${API_URL}/api/pain-points${queryString ? `?${queryString}` : ''}`;
      
      const response = await axios.get(url);
      return response.data;
    }
  });

  const allPainPointLinks = useQuery<Record<string, number>>({
    queryKey: ["allPainPointLinksStats"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/pain-point-links/stats`);
      return response.data;
    }
  });

  const { data: allLinks = [], isLoading: linksLoading } = useQuery<Array<{ 
    painPointId: string; 
    useCaseName: string | null;
    percentageSolved: number | null;
    totalHoursPerMonth: number | null;
    painPointStatement: string | null;
    fteCount: number | null;
  }>>({
    queryKey: ["allPainPointLinksDetails"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/pain-point-links/all`);
      return response.data;
    }
  });

  // Single source of truth for filtered pain point IDs (used in multiple calculations)
  const filteredPainPointIds = new Set((allPainPoints.data || []).map(pp => pp.id));

  // Count pain points that match current filters AND have links
  const painPointsWithLinksCount = Object.entries(allPainPointLinks.data || {})
    .filter(([id, count]) => filteredPainPointIds.has(id) && count > 0)
    .length;

  // Filter links to only include those for filtered pain points
  const filteredLinksData = allLinks.filter(link => 
    filteredPainPointIds.has(link.painPointId)
  );

  // Calculate potential hours saved based on filtered data
  // Uses percentageSolved from links (set when linking pain points to use cases)
  const potentialHoursSaved = Math.round(
    (() => {
      const painPointSavings = new Map<string, { hours: number; totalPercentage: number }>();
      
      filteredLinksData.forEach((link) => {
        const solvedPercentage = link.percentageSolved !== null ? Number(link.percentageSolved) : 0;
        if (link.totalHoursPerMonth !== null) {
          const existing = painPointSavings.get(link.painPointId) || { hours: Number(link.totalHoursPerMonth), totalPercentage: 0 };
          painPointSavings.set(link.painPointId, {
            hours: Number(link.totalHoursPerMonth),
            totalPercentage: existing.totalPercentage + solvedPercentage
          });
        }
      });
      
      let totalSavings = 0;
      painPointSavings.forEach(({ hours, totalPercentage }) => {
        const cappedPercentage = Math.min(totalPercentage, 100);
        totalSavings += hours * (cappedPercentage / 100);
      });
      
      return totalSavings;
    })()
  );

  // Build set of valid process IDs based on current filter
  // Handle loading states to avoid showing incorrect counts
  const validProcessIds = (() => {
    if (selectedProcessId) {
      return new Set([selectedProcessId]);
    } else if (selectedBusinessUnitId) {
      // Wait for processes to load before filtering
      if (processesLoading) return null;
      // If loaded but empty, return empty Set (shows 0 correctly)
      return new Set(processes.map(p => p.id));
    } else if (selectedCompanyId) {
      // Wait for both businessUnits and companyProcesses to load
      if (businessUnitsLoading || companyProcessesLoading) return null;
      // If loaded, filter processes by company's business units
      const companyBuIds = new Set(businessUnits.map(bu => bu.id));
      return new Set(companyProcesses.filter(p => companyBuIds.has(p.businessUnitId)).map(p => p.id));
    }
    return null;
  })();

  // Count total process links (how many processes are affected by pain points)
  const totalProcessLinks = (allPainPoints.data || []).reduce(
    (sum, pp) => {
      const processIds = pp.processIds || [];
      if (validProcessIds === null) {
        return sum + processIds.length;
      }
      return sum + processIds.filter(id => validProcessIds.has(id)).length;
    }, 
    0
  );

  const metricsData = {
    totalPainPoints: allPainPoints.data?.length || 0,
    totalUseCases: useCases.length,
    painPointsWithLinks: painPointsWithLinksCount,
    totalHoursPerMonth: potentialHoursSaved,
    totalFTE: Math.ceil((allPainPoints.data || []).reduce((sum, pp) => sum + Number(pp.fteCount || 0), 0)),
    totalProcessLinks
  };

  const matrixData = (allPainPoints.data || []).map(pp => ({
    id: pp.id,
    statement: pp.statement,
    magnitude: pp.magnitude || 0,
    effortSolving: pp.effortSolving || 0,
    totalHoursPerMonth: pp.totalHoursPerMonth || 0,
    hasLinks: (allPainPointLinks.data?.[pp.id] || 0) > 0,
    linkedUseCases: allLinks.filter(link => link.painPointId === pp.id).map(link => link.useCaseName).filter((name): name is string => name !== null)
  }));

  return (
    <div className="space-y-6 fade-in">
      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analytics and opportunity management
        </p>
      </div>

      <FilterByContext />

      <MetricsCards {...metricsData} />
      
      <PrioritizationMatrix painPoints={matrixData} />
      
      <LinkedPainPointsTable data={filteredLinksData} isLoading={linksLoading} />
      
      {matrixData.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-6 slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">
                Pain Points Overview
              </h2>
              <span className="text-sm text-muted-foreground">
                ({matrixData.filter(p => p.hasLinks).length} linked, {matrixData.filter(p => !p.hasLinks).length} unlinked)
              </span>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded-lg font-medium">Linked</span>
              <span className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg font-medium">Unlinked</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Manage solution links for each pain point. Click "Manage" to add, edit, or remove linked solutions.
          </p>
          <div className="space-y-3">
            {matrixData.map((painPoint) => (
              <div 
                key={painPoint.id} 
                className={`flex items-center justify-between p-4 border rounded-xl transition-all duration-200 ${
                  painPoint.hasLinks 
                    ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10' 
                    : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{painPoint.statement}</p>
                    {painPoint.hasLinks ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                        {painPoint.linkedUseCases.length} solution{painPoint.linkedUseCases.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-full">
                        No solutions
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Benefit: {painPoint.magnitude}/10</span>
                    <span>Effort: {painPoint.effortSolving}/10</span>
                    <span>Hours/Month: {Math.round(painPoint.totalHoursPerMonth)}</span>
                  </div>
                  {painPoint.hasLinks && painPoint.linkedUseCases.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Solutions: {painPoint.linkedUseCases.join(', ')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    const pp = allPainPoints.data?.find(p => p.id === painPoint.id);
                    if (pp) handleOpenLinkModal(pp);
                  }}
                  className={`ml-4 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                    painPoint.hasLinks
                      ? 'text-green-500 bg-green-500/10 hover:bg-green-500/20'
                      : 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                  }`}
                >
                  {painPoint.hasLinks ? 'Manage' : 'Link Solution'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLink ? "Update" : "Link"} Solution
            </DialogTitle>
          </DialogHeader>
          {selectedPainPoint && (
            <div className="mb-4 p-4 bg-accent/50 rounded-xl border border-border">
              <p className="text-sm font-medium text-muted-foreground">Pain Point:</p>
              <p className="text-sm text-foreground mt-1">{selectedPainPoint.statement}</p>
            </div>
          )}

          {selectedPainPointLinks.length > 0 && (
            <div className="border border-border rounded-xl p-4 mb-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Linked Solutions</h4>
              <div className="space-y-2">
                {selectedPainPointLinks.map((link) => {
                  const isEditing = editingLink?.id === link.id;
                  return (
                    <div
                      key={link.id}
                      className={`flex items-center justify-between rounded-xl p-3 transition-all duration-200 ${
                        isEditing 
                          ? 'bg-primary/10 border-2 border-primary/30' 
                          : 'bg-accent/30 hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${isEditing ? 'text-primary' : 'text-foreground'}`}>
                            {link.useCaseName}
                          </span>
                          {isEditing && (
                            <span className="px-2 py-0.5 text-xs font-medium gradient-bg text-white rounded-full">
                              Editing
                            </span>
                          )}
                        </div>
                        {link.percentageSolved !== null && (
                          <div className={`text-xs ${isEditing ? 'text-primary/80' : 'text-muted-foreground'}`}>
                            Solves {link.percentageSolved}% of this pain point
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => resetLinkForm()}
                            className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-accent hover:bg-accent/80 rounded-lg transition-colors"
                            title="Cancel editing"
                          >
                            Cancel
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditLink(link)}
                              className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Edit link"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLink(selectedPainPoint!.id, link.id)}
                              className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Remove link"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitLink} className="space-y-4">
            {!editingLink && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Solution
                </label>
                <select
                  value={selectedUseCaseId}
                  onChange={(e) => setSelectedUseCaseId(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                >
                  <option value="">Select a solution...</option>
                  {useCases.map((useCase) => (
                    <option key={useCase.id} value={useCase.id}>
                      {useCase.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {totalAllocatedPercentage > 0 && (
              <div className={`p-4 border rounded-xl ${isOverAllocated ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isOverAllocated ? 'text-red-500' : 'text-amber-500'}`}>
                    {isOverAllocated ? 'Over-Allocated!' : 'Current Coverage'}
                  </span>
                  <span className={`text-sm font-bold ${isOverAllocated ? 'text-red-500' : 'text-amber-500'}`}>
                    {totalAllocatedPercentage}% allocated
                  </span>
                </div>
                <div className={`w-full rounded-full h-2 ${isOverAllocated ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                  <div 
                    className={`h-2 rounded-full transition-all ${isOverAllocated ? 'bg-red-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(totalAllocatedPercentage, 100)}%` }}
                  />
                </div>
                <p className={`mt-2 text-xs ${isOverAllocated ? 'text-red-500/80' : 'text-amber-500/80'}`}>
                  {isOverAllocated
                    ? `This pain point exceeds 100% coverage by ${totalAllocatedPercentage - 100}%. Please reduce existing allocations.`
                    : remainingPercentage > 0 
                      ? `You can allocate up to ${remainingPercentage}% more to this pain point.`
                      : "This pain point is fully addressed by existing solutions."}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                % of Pain Point Solved
                {remainingPercentage < 100 && (
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    (max {remainingPercentage}% allowed)
                  </span>
                )}
              </label>
              <input
                type="number"
                min="0"
                max={remainingPercentage}
                value={percentageSolved}
                onChange={(e) => setPercentageSolved(e.target.value)}
                placeholder={`e.g., ${Math.min(80, remainingPercentage)}`}
                className={`w-full px-4 py-3 border bg-background text-foreground rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200 ${
                  !isPercentageValid 
                    ? "border-red-500/50 focus:ring-red-500 bg-red-500/5" 
                    : "border-border focus:ring-primary"
                }`}
              />
              {!isPercentageValid && (
                <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Cannot exceed {remainingPercentage}%
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Additional context about this solution..."
                className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                className="flex-1"
                disabled={!canSubmit}
              >
                {editingLink ? "Update Link" : "Create Link"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLinkModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
