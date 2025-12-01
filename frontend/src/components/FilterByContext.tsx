import { useFilterStore } from "../stores/filterStore";
import { useCompanies, useBusinessUnitsFlat, useProcessesByBusinessUnit } from "../hooks/useApiData";

export function FilterByContext() {
  const {
    selectedCompanyId,
    selectedBusinessUnitId,
    selectedProcessId,
    setSelectedCompanyId,
    setSelectedBusinessUnitId,
    setSelectedProcessId,
  } = useFilterStore();

  const { data: companies = [] } = useCompanies();
  const { data: businessUnits = [] } = useBusinessUnitsFlat(selectedCompanyId);
  const { data: processes = [] } = useProcessesByBusinessUnit(selectedBusinessUnitId);

  const getIndent = (depth: number) => "\u2003".repeat(depth - 1);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 slide-up">
      <h2 className="text-lg font-semibold text-foreground mb-4">Filter by Context</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            disabled={!selectedBusinessUnitId}
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
      </div>
    </div>
  );
}
