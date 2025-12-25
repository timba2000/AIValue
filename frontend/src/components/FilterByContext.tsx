import { useMemo } from "react";
import { useFilterStore, PainPointFilterType } from "../stores/filterStore";
import { useCompanies, useBusinessUnitsFlat, useAllProcesses, useAllBusinessUnits } from "../hooks/useApiData";

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

export function FilterByContext() {
  const {
    selectedCompanyId,
    selectedBusinessUnitId,
    selectedL1Process,
    selectedL2Process,
    selectedProcessId,
    painPointFilter,
    setSelectedCompanyId,
    setSelectedBusinessUnitId,
    setSelectedL1Process,
    setSelectedL2Process,
    setSelectedProcessId,
    setPainPointFilter,
  } = useFilterStore();

  const { data: companies = [] } = useCompanies();
  const { data: businessUnits = [] } = useBusinessUnitsFlat(selectedCompanyId);
  const { data: allBusinessUnits = [] } = useAllBusinessUnits();
  const { data: allProcesses = [] } = useAllProcesses();

  const processes = useMemo(() => {
    if (selectedBusinessUnitId) {
      return allProcesses.filter(p => p.businessUnitId === selectedBusinessUnitId);
    }
    if (selectedCompanyId) {
      const companyBuIds = new Set(allBusinessUnits.filter(bu => bu.companyId === selectedCompanyId).map(bu => bu.id));
      return allProcesses.filter(p => companyBuIds.has(p.businessUnitId));
    }
    return allProcesses;
  }, [selectedBusinessUnitId, selectedCompanyId, allProcesses, allBusinessUnits]);

  const l1Options = useMemo(() => {
    const l1Set = new Set<string>();
    processes.forEach(p => {
      const { l1 } = parseProcessHierarchy(p.name);
      if (l1 && l1 !== "-") {
        l1Set.add(l1);
      }
    });
    return Array.from(l1Set).sort();
  }, [processes]);

  const l2Options = useMemo(() => {
    if (!selectedL1Process) return [];
    const l2Set = new Set<string>();
    processes.forEach(p => {
      const { l1, l2 } = parseProcessHierarchy(p.name);
      if (l1 === selectedL1Process && l2 && l2 !== "-") {
        l2Set.add(l2);
      }
    });
    return Array.from(l2Set).sort();
  }, [processes, selectedL1Process]);

  const filteredProcessOptions = useMemo(() => {
    let filtered = processes;
    if (selectedL1Process) {
      filtered = filtered.filter(p => {
        const { l1 } = parseProcessHierarchy(p.name);
        return l1 === selectedL1Process;
      });
    }
    if (selectedL2Process) {
      filtered = filtered.filter(p => {
        const { l2 } = parseProcessHierarchy(p.name);
        return l2 === selectedL2Process;
      });
    }
    return filtered;
  }, [processes, selectedL1Process, selectedL2Process]);

  const getIndent = (depth: number) => "\u2003".repeat(depth - 1);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 slide-up">
      <h2 className="text-lg font-semibold text-foreground mb-4">Filter by Context</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Select Business
          </label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
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
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Select Business Unit
          </label>
          <select
            value={selectedBusinessUnitId}
            onChange={(e) => setSelectedBusinessUnitId(e.target.value)}
            disabled={!selectedCompanyId}
            className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <option value="">All Business Units</option>
            {businessUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {getIndent(unit.depth)}{unit.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Process L1
          </label>
          <select
            value={selectedL1Process}
            onChange={(e) => setSelectedL1Process(e.target.value)}
            disabled={l1Options.length === 0}
            className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <option value="">All L1 Processes</option>
            {l1Options.map((l1) => (
              <option key={l1} value={l1}>
                {l1}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Process L2
          </label>
          <select
            value={selectedL2Process}
            onChange={(e) => setSelectedL2Process(e.target.value)}
            disabled={!selectedL1Process || l2Options.length === 0}
            className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <option value="">All L2 Processes</option>
            {l2Options.map((l2) => (
              <option key={l2} value={l2}>
                {l2}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Select Process
          </label>
          <select
            value={selectedProcessId}
            onChange={(e) => setSelectedProcessId(e.target.value)}
            disabled={filteredProcessOptions.length === 0}
            className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <option value="">All Processes</option>
            {filteredProcessOptions.map((process) => (
              <option key={process.id} value={process.id}>
                {process.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Pain Points
          </label>
          <select
            value={painPointFilter}
            onChange={(e) => setPainPointFilter(e.target.value as PainPointFilterType)}
            className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
          >
            <option value="all">All Pain Points</option>
            <option value="linked">Linked to Solutions</option>
            <option value="unlinked">Unlinked</option>
          </select>
        </div>
      </div>
    </div>
  );
}
