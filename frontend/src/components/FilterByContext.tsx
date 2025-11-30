import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useFilterStore } from "../stores/filterStore";

const API_URL = import.meta.env.VITE_API_URL || "";

interface Company {
  id: string;
  name: string;
}

interface BusinessUnit {
  id: string;
  name: string;
  companyId: string;
}

interface Process {
  id: string;
  name: string;
  businessUnitId: string;
}

export function FilterByContext() {
  const {
    selectedCompanyId,
    selectedBusinessUnitId,
    selectedProcessId,
    setSelectedCompanyId,
    setSelectedBusinessUnitId,
    setSelectedProcessId,
  } = useFilterStore();

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/companies`);
      return response.data;
    },
  });

  const { data: businessUnits = [] } = useQuery<BusinessUnit[]>({
    queryKey: ["businessUnits", selectedCompanyId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/business-units`);
      return response.data.filter((bu: BusinessUnit) => bu.companyId === selectedCompanyId);
    },
    enabled: !!selectedCompanyId,
  });

  const { data: processes = [] } = useQuery<Process[]>({
    queryKey: ["processes", selectedBusinessUnitId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/processes`);
      return response.data.filter((p: Process) => p.businessUnitId === selectedBusinessUnitId);
    },
    enabled: !!selectedBusinessUnitId,
  });

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
                {unit.name}
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
