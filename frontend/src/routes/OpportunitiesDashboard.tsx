import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertTriangle, Link as LinkIcon, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { MetricsCards } from "@/components/dashboard/MetricsCards";
import { PrioritizationMatrix } from "@/components/dashboard/PrioritizationMatrix";

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
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    return localStorage.getItem("dashboard_selectedCompanyId") || "";
  });
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string>(() => {
    return localStorage.getItem("dashboard_selectedBusinessUnitId") || "";
  });
  const [selectedProcessId, setSelectedProcessId] = useState<string>("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedPainPoint, setSelectedPainPoint] = useState<PainPoint | null>(null);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState("");
  const [percentageSolved, setPercentageSolved] = useState("");
  const [notes, setNotes] = useState("");
  const [editingLink, setEditingLink] = useState<PainPointLink | null>(null);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/companies`);
      return response.data;
    }
  });

  const { data: businessUnits = [] } = useQuery<BusinessUnit[]>({
    queryKey: ["businessUnits", selectedCompanyId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/business-units`);
      return response.data.filter((bu: BusinessUnit) => bu.companyId === selectedCompanyId);
    },
    enabled: !!selectedCompanyId
  });

  const { data: processes = [] } = useQuery<Process[]>({
    queryKey: ["processes", selectedBusinessUnitId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/processes`);
      return response.data.filter(
        (p: Process) => p.businessUnitId === selectedBusinessUnitId
      );
    },
    enabled: !!selectedBusinessUnitId
  });

  const { data: painPoints = [] } = useQuery<PainPoint[]>({
    queryKey: ["painPoints", selectedProcessId],
    queryFn: async () => {
      if (!selectedProcessId) return [];
      const response = await axios.get(
        `${API_URL}/api/processes/${selectedProcessId}/pain-points`
      );
      return response.data;
    },
    enabled: !!selectedProcessId
  });

  const { data: useCases = [] } = useQuery<UseCase[]>({
    queryKey: ["useCases"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/use-cases`);
      return response.data;
    }
  });

  const linksQuery = (painPointId: string) =>
    useQuery<PainPointLink[]>({
      queryKey: ["painPointLinks", painPointId],
      queryFn: async () => {
        const response = await axios.get(
          `${API_URL}/api/pain-points/${painPointId}/links`
        );
        return response.data;
      },
      enabled: !!painPointId
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
      queryClient.invalidateQueries({ queryKey: ["painPoints", selectedProcessId] });
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
      queryClient.invalidateQueries({ queryKey: ["painPoints", selectedProcessId] });
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
      queryClient.invalidateQueries({ queryKey: ["painPoints", selectedProcessId] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksStats"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksDetails"] });
    }
  });

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedBusinessUnitId("");
    setSelectedProcessId("");
    localStorage.setItem("dashboard_selectedCompanyId", companyId);
    localStorage.removeItem("dashboard_selectedBusinessUnitId");
  };

  const handleBusinessUnitChange = (businessUnitId: string) => {
    setSelectedBusinessUnitId(businessUnitId);
    setSelectedProcessId("");
    localStorage.setItem("dashboard_selectedBusinessUnitId", businessUnitId);
  };

  const handleOpenLinkModal = (painPoint: PainPoint) => {
    setSelectedPainPoint(painPoint);
    setLinkModalOpen(true);
    resetLinkForm();
  };

  const handleEditLink = (painPoint: PainPoint, link: PainPointLink) => {
    setSelectedPainPoint(painPoint);
    setEditingLink(link);
    setSelectedUseCaseId(link.useCaseId);
    setPercentageSolved(link.percentageSolved?.toString() || "");
    setNotes(link.notes || "");
    setLinkModalOpen(true);
  };

  const resetLinkForm = () => {
    setSelectedUseCaseId("");
    setPercentageSolved("");
    setNotes("");
    setEditingLink(null);
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

  const handleDeleteLink = (painPointId: string, linkId: string) => {
    if (confirm("Are you sure you want to remove this link?")) {
      deleteLinkMutation.mutate({ painPointId, linkId });
    }
  };

  const PainPointCard = ({ painPoint }: { painPoint: PainPoint }) => {
    const { data: links = [] } = linksQuery(painPoint.id);
    const hasLinks = links.length > 0;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900">{painPoint.statement}</h3>
              {hasLinks ? (
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-md flex items-center gap-1">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  Linked
                </span>
              ) : (
                <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-md flex items-center gap-1">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  Not Linked
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-3 mb-3">
              {painPoint.impactType?.map((type) => (
                <span
                  key={type}
                  className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-md"
                >
                  {type}
                </span>
              ))}
              {painPoint.riskLevel && (
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-md ${
                    painPoint.riskLevel === "High"
                      ? "bg-red-100 text-red-700"
                      : painPoint.riskLevel === "Medium"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {painPoint.riskLevel} Risk
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              {painPoint.magnitude !== null && (
                <div>
                  <span className="text-gray-600">Impact: </span>
                  <span className="font-medium text-gray-900">{painPoint.magnitude}/10</span>
                </div>
              )}
              {painPoint.effortSolving !== null && (
                <div>
                  <span className="text-gray-600">Effort: </span>
                  <span className="font-medium text-gray-900">
                    {painPoint.effortSolving}/10
                  </span>
                </div>
              )}
              {painPoint.totalHoursPerMonth !== null && (
                <div>
                  <span className="text-gray-600">Hours/Month: </span>
                  <span className="font-medium text-gray-900">
                    {painPoint.totalHoursPerMonth}
                  </span>
                </div>
              )}
            </div>

            {links.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Linked Use Cases:</h4>
                <div className="space-y-2">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between bg-gray-50 rounded-md p-2"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">
                          {link.useCaseName}
                        </div>
                        {link.percentageSolved !== null && (
                          <div className="text-xs text-gray-600">
                            Solves {link.percentageSolved}% of this pain point
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditLink(painPoint, link)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit link"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLink(painPoint.id, link.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove link"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <Button
            onClick={() => handleOpenLinkModal(painPoint)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            Link Use Case
          </Button>
        </div>
      </div>
    );
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

  const painPointsWithLinksCount = Object.values(allPainPointLinks.data || {}).filter(count => count > 0).length;

  const { data: allLinks = [] } = useQuery<Array<{ 
    painPointId: string; 
    useCaseName: string;
    percentageSolved: number | null;
    totalHoursPerMonth: number | null;
  }>>({
    queryKey: ["allPainPointLinksDetails"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/pain-point-links/all`);
      return response.data;
    }
  });

  const potentialHoursSaved = Math.round(
    (() => {
      const painPointSavings = new Map<string, { hours: number; totalPercentage: number }>();
      
      allLinks.forEach((link) => {
        if (link.percentageSolved !== null && link.totalHoursPerMonth !== null) {
          const existing = painPointSavings.get(link.painPointId) || { hours: link.totalHoursPerMonth, totalPercentage: 0 };
          painPointSavings.set(link.painPointId, {
            hours: link.totalHoursPerMonth,
            totalPercentage: existing.totalPercentage + link.percentageSolved
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

  const metricsData = {
    totalPainPoints: allPainPoints.data?.length || 0,
    totalUseCases: useCases.length,
    painPointsWithLinks: painPointsWithLinksCount,
    totalHoursPerMonth: potentialHoursSaved,
    totalFTE: Math.ceil((allPainPoints.data || []).reduce((sum, pp) => sum + Number(pp.fteCount || 0), 0))
  };

  const matrixData = (allPainPoints.data || []).map(pp => ({
    id: pp.id,
    statement: pp.statement,
    magnitude: pp.magnitude || 0,
    effortSolving: pp.effortSolving || 0,
    totalHoursPerMonth: pp.totalHoursPerMonth || 0,
    hasLinks: (allPainPointLinks.data?.[pp.id] || 0) > 0,
    linkedUseCases: allLinks.filter(link => link.painPointId === pp.id).map(link => link.useCaseName)
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Dashboard
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Analytics and opportunity management
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter by Context</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Business
            </label>
            <select
              value={selectedCompanyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Businesses</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Business Unit
            </label>
            <select
              value={selectedBusinessUnitId}
              onChange={(e) => handleBusinessUnitChange(e.target.value)}
              disabled={!selectedCompanyId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">All Business Units</option>
              {businessUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Process
            </label>
            <select
              value={selectedProcessId}
              onChange={(e) => setSelectedProcessId(e.target.value)}
              disabled={!selectedBusinessUnitId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">All Processes</option>
              {processes.map((process) => (
                <option key={process.id} value={process.id}>
                  {process.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          <MetricsCards {...metricsData} />
          <PrioritizationMatrix painPoints={matrixData} />
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Pain Points
            {selectedCompanyId && !selectedBusinessUnitId && !selectedProcessId &&
              ` for ${companies.find((c) => c.id === selectedCompanyId)?.name}`}
            {selectedBusinessUnitId && !selectedProcessId &&
              ` for ${businessUnits.find((bu) => bu.id === selectedBusinessUnitId)?.name}`}
            {selectedProcessId &&
              ` for ${processes.find((p) => p.id === selectedProcessId)?.name}`}
          </h2>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md flex items-center gap-1">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
              Linked to Use Case
            </span>
            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md flex items-center gap-1">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              Not Yet Linked
            </span>
          </div>
        </div>

        {!allPainPoints.data || allPainPoints.data.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {selectedCompanyId || selectedBusinessUnitId || selectedProcessId
                ? "No pain points found for the selected filters"
                : "No pain points found in the system"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {selectedCompanyId || selectedBusinessUnitId || selectedProcessId
                ? "Try adjusting your filters or add pain points to processes in this context"
                : "Create pain points and link them to processes to get started"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {allPainPoints.data.map((painPoint) => (
              <PainPointCard key={painPoint.id} painPoint={painPoint} />
            ))}
          </div>
        )}
      </div>
        </TabsContent>
      </Tabs>

      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLink ? "Update" : "Link"} Use Case
            </DialogTitle>
          </DialogHeader>
          {selectedPainPoint && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Pain Point:</p>
              <p className="text-sm text-gray-900">{selectedPainPoint.statement}</p>
            </div>
          )}

          <form onSubmit={handleSubmitLink} className="space-y-4">
            {!editingLink && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Use Case
                </label>
                <select
                  value={selectedUseCaseId}
                  onChange={(e) => setSelectedUseCaseId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a use case...</option>
                  {useCases.map((useCase) => (
                    <option key={useCase.id} value={useCase.id}>
                      {useCase.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                % of Pain Point Solved (0-100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={percentageSolved}
                onChange={(e) => setPercentageSolved(e.target.value)}
                placeholder="e.g., 80"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Additional context about this solution..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">
                {editingLink ? "Update Link" : "Create Link"}
              </Button>
              <Button
                type="button"
                variant="outline"
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
