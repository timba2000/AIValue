import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link2, Unlink, Check, AlertTriangle, Zap, Clock, TrendingUp, Search, X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

interface PainPoint {
  id: string;
  statement: string;
  magnitude: string | null;
  frequency: string | null;
  timePerUnit: string | null;
  totalHoursPerMonth: string | null;
  fteCount: string | null;
  riskLevel: string | null;
}

interface UseCase {
  id: string;
  name: string;
  expectedBenefits: string | null;
  complexity: string | null;
  confidenceLevel: string | null;
  estimatedDeliveryTime: string | null;
  costRange: string | null;
}

interface ExistingLink {
  id: string;
  painPointId: string;
  useCaseId: string;
  percentageSolved: string | null;
  notes: string | null;
}

interface LinkManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "pain-point" | "use-case";
  sourceId: string;
  sourceName: string;
}

export function LinkManagerModal({ 
  open, 
  onOpenChange, 
  mode, 
  sourceId, 
  sourceName 
}: LinkManagerModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [percentageSolved, setPercentageSolved] = useState("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"select" | "configure">("select");

  const { data: painPoints = [] } = useQuery<PainPoint[]>({
    queryKey: ["allPainPoints"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/pain-points`);
      return response.data;
    },
    enabled: mode === "use-case"
  });

  const { data: useCases = [] } = useQuery<UseCase[]>({
    queryKey: ["useCases"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/use-cases`);
      return response.data;
    },
    enabled: mode === "pain-point"
  });

  const { data: existingLinks = [] } = useQuery<ExistingLink[]>({
    queryKey: ["painPointLinks", sourceId],
    queryFn: async () => {
      if (mode === "pain-point") {
        const response = await axios.get(`${API_URL}/api/pain-points/${sourceId}/links`);
        return response.data;
      } else {
        const response = await axios.get(`${API_URL}/api/use-cases/${sourceId}/pain-points`);
        return response.data;
      }
    },
    enabled: !!sourceId
  });

  const linkedItemIds = useMemo(() => {
    return new Set(existingLinks.map(link => 
      mode === "pain-point" ? link.useCaseId : link.painPointId
    ));
  }, [existingLinks, mode]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["painPointLinks"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPoints"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksStats"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksDetails"] });
      queryClient.invalidateQueries({ queryKey: ["useCasePainPoints"] });
      queryClient.invalidateQueries({ queryKey: ["useCaseLinkStats"] });
      resetForm();
    }
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (data: { painPointId: string; linkId: string }) => {
      await axios.delete(`${API_URL}/api/pain-points/${data.painPointId}/links/${data.linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["painPointLinks"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPoints"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksStats"] });
      queryClient.invalidateQueries({ queryKey: ["allPainPointLinksDetails"] });
      queryClient.invalidateQueries({ queryKey: ["useCasePainPoints"] });
      queryClient.invalidateQueries({ queryKey: ["useCaseLinkStats"] });
    }
  });

  const resetForm = () => {
    setSelectedItemId(null);
    setPercentageSolved("");
    setNotes("");
    setStep("select");
    setSearchQuery("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setStep("configure");
  };

  const handleCreateLink = () => {
    if (!selectedItemId) return;

    const painPointId = mode === "pain-point" ? sourceId : selectedItemId;
    const useCaseId = mode === "pain-point" ? selectedItemId : sourceId;

    createLinkMutation.mutate({
      painPointId,
      useCaseId,
      percentageSolved: percentageSolved ? Number(percentageSolved) : null,
      notes: notes || null
    });
  };

  const handleUnlink = (link: ExistingLink) => {
    if (confirm("Remove this link?")) {
      deleteLinkMutation.mutate({
        painPointId: link.painPointId,
        linkId: link.id
      });
    }
  };

  const items = mode === "pain-point" ? useCases : painPoints;
  const filteredItems = items.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    if (mode === "pain-point") {
      return (item as UseCase).name.toLowerCase().includes(searchLower);
    } else {
      return (item as PainPoint).statement.toLowerCase().includes(searchLower);
    }
  });

  const unlinkedItems = filteredItems.filter(item => !linkedItemIds.has(item.id));
  const linkedItems = filteredItems.filter(item => linkedItemIds.has(item.id));

  const selectedItem = selectedItemId 
    ? items.find(item => item.id === selectedItemId)
    : null;

  const getRiskColor = (risk: string | null) => {
    switch (risk?.toLowerCase()) {
      case "critical": return "bg-red-100 text-red-700 border-red-200";
      case "high": return "bg-orange-100 text-orange-700 border-orange-200";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low": return "bg-green-100 text-green-700 border-green-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getComplexityColor = (complexity: string | null) => {
    switch (complexity?.toLowerCase()) {
      case "high": return "bg-red-100 text-red-700";
      case "medium": return "bg-yellow-100 text-yellow-700";
      case "low": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600" />
            {mode === "pain-point" ? "Link Use Cases" : "Link Pain Points"}
          </DialogTitle>
          <div className="mt-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
            <p className="text-sm text-gray-600">Linking to:</p>
            <p className="font-medium text-gray-900 line-clamp-2">{sourceName}</p>
          </div>
        </DialogHeader>

        {step === "select" ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${mode === "pain-point" ? "use cases" : "pain points"}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {linkedItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Currently Linked ({linkedItems.length})
                  </h4>
                  <div className="space-y-2">
                    {linkedItems.map(item => {
                      const link = existingLinks.find(l => 
                        mode === "pain-point" ? l.useCaseId === item.id : l.painPointId === item.id
                      );
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg border-2 border-green-200 bg-green-50 flex items-start justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 line-clamp-2">
                              {mode === "pain-point" ? (item as UseCase).name : (item as PainPoint).statement}
                            </p>
                            {link?.percentageSolved && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                  {link.percentageSolved}% solved
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => link && handleUnlink(link)}
                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                            title="Remove link"
                          >
                            <Unlink className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {unlinkedItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">
                    Available to Link ({unlinkedItems.length})
                  </h4>
                  <div className="space-y-2">
                    {unlinkedItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleSelectItem(item.id)}
                        className="w-full p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 line-clamp-2 group-hover:text-blue-700">
                              {mode === "pain-point" ? (item as UseCase).name : (item as PainPoint).statement}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {mode === "pain-point" ? (
                                <>
                                  {(item as UseCase).expectedBenefits && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3" />
                                      {(item as UseCase).expectedBenefits}% benefit
                                    </span>
                                  )}
                                  {(item as UseCase).complexity && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${getComplexityColor((item as UseCase).complexity)}`}>
                                      {(item as UseCase).complexity} complexity
                                    </span>
                                  )}
                                  {(item as UseCase).estimatedDeliveryTime && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {(item as UseCase).estimatedDeliveryTime}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  {(item as PainPoint).totalHoursPerMonth && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {parseFloat((item as PainPoint).totalHoursPerMonth!).toFixed(0)} hrs/month
                                    </span>
                                  )}
                                  {(item as PainPoint).riskLevel && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getRiskColor((item as PainPoint).riskLevel)}`}>
                                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                                      {(item as PainPoint).riskLevel}
                                    </span>
                                  )}
                                  {(item as PainPoint).magnitude && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                                      <Zap className="h-3 w-3" />
                                      Impact: {(item as PainPoint).magnitude}/10
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="p-2 rounded-full bg-blue-100 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link2 className="h-4 w-4" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {unlinkedItems.length === 0 && linkedItems.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No {mode === "pain-point" ? "use cases" : "pain points"} found</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {selectedItem && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">
                    {mode === "pain-point" ? "Use Case" : "Pain Point"}
                  </h4>
                  <p className="font-medium text-gray-900">
                    {mode === "pain-point" 
                      ? (selectedItem as UseCase).name 
                      : (selectedItem as PainPoint).statement
                    }
                  </p>
                  
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mode === "pain-point" ? (
                      <>
                        {(selectedItem as UseCase).expectedBenefits && (
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                            Expected benefit: {(selectedItem as UseCase).expectedBenefits}%
                          </span>
                        )}
                        {(selectedItem as UseCase).complexity && (
                          <span className={`text-xs px-2 py-1 rounded-full ${getComplexityColor((selectedItem as UseCase).complexity)}`}>
                            {(selectedItem as UseCase).complexity} complexity
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {(selectedItem as PainPoint).totalHoursPerMonth && (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                            {parseFloat((selectedItem as PainPoint).totalHoursPerMonth!).toFixed(0)} hrs/month
                          </span>
                        )}
                        {(selectedItem as PainPoint).riskLevel && (
                          <span className={`text-xs px-2 py-1 rounded-full border ${getRiskColor((selectedItem as PainPoint).riskLevel)}`}>
                            {(selectedItem as PainPoint).riskLevel} risk
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        Percentage of Pain Point Solved
                      </div>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={percentageSolved}
                        onChange={(e) => setPercentageSolved(e.target.value)}
                        placeholder="e.g., 80"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">%</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      How much of this pain point does the use case address?
                    </p>
                  </div>

                  {mode === "pain-point" && selectedItem && (selectedItem as UseCase).expectedBenefits && percentageSolved && (
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 text-green-700">
                        <TrendingUp className="h-5 w-5" />
                        <span className="font-medium">Projected Impact</span>
                      </div>
                      <p className="mt-1 text-sm text-green-600">
                        With {percentageSolved}% coverage and {(selectedItem as UseCase).expectedBenefits}% expected benefits, 
                        this solution could achieve approximately{" "}
                        <strong>
                          {Math.round(Number(percentageSolved) * Number((selectedItem as UseCase).expectedBenefits) / 100)}%
                        </strong>{" "}
                        overall improvement.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Add context about how this use case addresses the pain point..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="border-t pt-4 mt-4">
          {step === "configure" ? (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button 
                onClick={handleCreateLink}
                disabled={createLinkMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createLinkMutation.isPending ? (
                  "Linking..."
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Create Link
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
