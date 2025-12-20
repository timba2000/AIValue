import { useMemo } from "react";
import { useFilterStore, PainPointFilterType } from "../stores/filterStore";
import { useCompanies, useBusinessUnitsFlat, useProcessesByBusinessUnit, useAllProcesses, useAllBusinessUnits } from "../hooks/useApiData";

export function FilterByContext() {
  const {
    selectedCompanyId,
    selectedBusinessUnitId,
    selectedProcessId,
    painPointFilter,
    setSelectedCompanyId,
    setSelectedBusinessUnitId,
    setSelectedProcessId,
    setPainPointFilter,
  } = useFilterStore();

  const { data: companies = [] } = useCompanies();
  const { data: businessUnits = [] } = useBusinessUnitsFlat(selectedCompanyId);
  const { data: allBusinessUnits = [] } = useAllBusinessUnits();
  const { data: processesByBU = [] } = useProcessesByBusinessUnit(selectedBusinessUnitId);
  const { data: allProcesses = [] } = useAllProcesses();

  const processes = useMemo(() => {
    if (selectedBusinessUnitId) {
      return processesByBU;
    }
    if (selectedCompanyId) {
      const companyBuIds = new Set(allBusinessUnits.filter(bu => bu.companyId === selectedCompanyId).map(bu => bu.id));
      return allProcesses.filter(p => companyBuIds.has(p.businessUnitId));
    }
    return allProcesses;
  }, [selectedBusinessUnitId, selectedCompanyId, processesByBU, allProcesses, allBusinessUnits]);

  const getIndent = (depth: number) => "\u2003".repeat(depth - 1);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 slide-up">
      <h2 className="text-lg font-semibold text-foreground mb-4">Filter by Context</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            Select Process
          </label>
          <select
            value={selectedProcessId}
            onChange={(e) => setSelectedProcessId(e.target.value)}
            disabled={processes.length === 0}
            className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <option value="">All Processes</option>
            {processes.map((process) => (
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
