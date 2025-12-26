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

  const totalAllocatedPercentage = useMemo(() => {
    if (mode !== "pain-point") return 0;
    return existingLinks.reduce((sum, link) => {
      return sum + (link.percentageSolved ? Number(link.percentageSolved) : 0);
    }, 0);
  }, [existingLinks, mode]);

  const remainingPercentage = Math.max(0, 100 - totalAllocatedPercentage);
  const isOverAllocated = totalAllocatedPercentage > 100;

  const isPercentageValid = useMemo(() => {
    if (!percentageSolved) return true;
    const value = Number(percentageSolved);
    if (value < 0) return false;
    return value <= remainingPercentage;
  }, [percentageSolved, remainingPercentage]);

  const canCreateLink = useMemo(() => {
    if (!isPercentageValid) return false;
    if (mode === "pain-point" && isOverAllocated) return false;
    return true;
  }, [isPercentageValid, mode, isOverAllocated]);

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
      resetFormKeepSearch();
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

  const resetFormKeepSearch = () => {
    setSelectedItemId(null);
    setPercentageSolved("");
    setNotes("");
    setStep("select");
  };

  const resetForm = () => {
    resetFormKeepSearch();
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
    const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (searchWords.length === 0) return true;
    
    const textToSearch = mode === "pain-point" 
      ? (item as UseCase).name.toLowerCase()
      : (item as PainPoint).statement.toLowerCase();
    
    const textWords = textToSearch.match(/\b\w+\b/g) || [];
    return searchWords.every(searchWord => 
      textWords.some(textWord => textWord.startsWith(searchWord))
    );
  });

  const unlinkedItems = filteredItems.filter(item => !linkedItemIds.has(item.id));
  const linkedItems = filteredItems.filter(item => linkedItemIds.has(item.id));

  const selectedItem = selectedItemId 
    ? items.find(item => item.id === selectedItemId)
    : null;

  const getRiskColor = (risk: string | null) => {
    switch (risk?.toLowerCase()) {
      case "critical": return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
      case "low": return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      default: return "bg-accent text-muted-foreground border-border";
    }
  };

  const getComplexityColor = (complexity: string | null) => {
    switch (complexity?.toLowerCase()) {
      case "high": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "medium": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "low": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      default: return "bg-accent text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {mode === "pain-point" ? "Link Solutions" : "Link Pain Points"}
          </DialogTitle>
          <div className="mt-2 p-3 bg-primary/10 rounded-xl border border-primary/20">
            <p className="text-sm text-muted-foreground">Linking to:</p>
            <p className="font-medium text-foreground line-clamp-2" title={sourceName}>{sourceName}</p>
          </div>
        </DialogHeader>

        {step === "select" ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={`Search ${mode === "pain-point" ? "solutions" : "pain points"}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {linkedItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
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
                          className="p-3 rounded-xl border-2 border-green-500/30 bg-green-500/10 flex items-start justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground line-clamp-2" title={mode === "pain-point" ? (item as UseCase).name : (item as PainPoint).statement}>
                              {mode === "pain-point" ? (item as UseCase).name : (item as PainPoint).statement}
                            </p>
                            {link?.percentageSolved && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
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
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Available to Link ({unlinkedItems.length})
                  </h4>
                  <div className="space-y-2">
                    {unlinkedItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleSelectItem(item.id)}
                        className="w-full p-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent transition-all text-left group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground line-clamp-2 group-hover:text-primary" title={mode === "pain-point" ? (item as UseCase).name : (item as PainPoint).statement}>
                              {mode === "pain-point" ? (item as UseCase).name : (item as PainPoint).statement}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {mode === "pain-point" ? (
                                <>
                                  {(item as UseCase).complexity && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${getComplexityColor((item as UseCase).complexity)}`}>
                                      {(item as UseCase).complexity} complexity
                                    </span>
                                  )}
                                  {(item as UseCase).estimatedDeliveryTime && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {(item as UseCase).estimatedDeliveryTime}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  {(item as PainPoint).totalHoursPerMonth && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
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
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                      <Zap className="h-3 w-3" />
                                      Impact: {(item as PainPoint).magnitude}/10
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="p-2 rounded-full bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link2 className="h-4 w-4" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {unlinkedItems.length === 0 && linkedItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No {mode === "pain-point" ? "solutions" : "pain points"} found</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {selectedItem && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    {mode === "pain-point" ? "Solution" : "Pain Point"}
                  </h4>
                  <p className="font-medium text-foreground">
                    {mode === "pain-point" 
                      ? (selectedItem as UseCase).name 
                      : (selectedItem as PainPoint).statement
                    }
                  </p>
                  
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mode === "pain-point" ? (
                      <>
                        {(selectedItem as UseCase).complexity && (
                          <span className={`text-xs px-2 py-1 rounded-full ${getComplexityColor((selectedItem as UseCase).complexity)}`}>
                            {(selectedItem as UseCase).complexity} complexity
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {(selectedItem as PainPoint).totalHoursPerMonth && (
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
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
                  {mode === "pain-point" && totalAllocatedPercentage > 0 && (
                    <div className={`p-3 border rounded-xl ${isOverAllocated ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${isOverAllocated ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {isOverAllocated ? 'Over-Allocated!' : 'Current Coverage'}
                        </span>
                        <span className={`text-sm font-bold ${isOverAllocated ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {totalAllocatedPercentage}% allocated
                        </span>
                      </div>
                      <div className={`w-full rounded-full h-2.5 ${isOverAllocated ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                        <div 
                          className={`h-2.5 rounded-full transition-all ${isOverAllocated ? 'bg-red-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(totalAllocatedPercentage, 100)}%` }}
                        />
                      </div>
                      <p className={`mt-2 text-xs ${isOverAllocated ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
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
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Percentage of Pain Point Solved
                        {mode === "pain-point" && remainingPercentage < 100 && (
                          <span className="text-xs font-normal text-muted-foreground">
                            (max {remainingPercentage}% available)
                          </span>
                        )}
                      </div>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max={mode === "pain-point" ? remainingPercentage : 100}
                        value={percentageSolved}
                        onChange={(e) => setPercentageSolved(e.target.value)}
                        placeholder={mode === "pain-point" ? `e.g., ${Math.min(80, remainingPercentage)}` : "e.g., 80"}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:border-transparent text-lg bg-background text-foreground transition-all duration-200 ${
                          !isPercentageValid 
                            ? "border-red-500 focus:ring-red-500 bg-red-500/10" 
                            : "border-border focus:ring-primary"
                        }`}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">%</span>
                    </div>
                    {!isPercentageValid && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Cannot exceed {remainingPercentage}% (total would be over 100%)
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      How much of this pain point does the solution address?
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Add context about how this solution addresses the pain point..."
                      className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all duration-200"
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
                disabled={createLinkMutation.isPending || !canCreateLink}
                className="gradient-bg text-white"
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
