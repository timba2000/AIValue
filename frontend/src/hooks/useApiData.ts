import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { Company, BusinessUnit, BusinessUnitWithChildren } from "@/types/business";
import type { ProcessRecord } from "@/types/process";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function useCompanies() {
  return useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await axios.get<Company[]>(`${API_BASE}/api/companies`);
      return response.data;
    },
    staleTime: 30000,
  });
}

export function useBusinessUnits(companyId?: string) {
  return useQuery<BusinessUnit[]>({
    queryKey: ["businessUnits", companyId ?? "all"],
    queryFn: async () => {
      if (companyId) {
        const response = await axios.get<BusinessUnit[]>(
          `${API_BASE}/api/companies/${companyId}/business-units`
        );
        return response.data;
      }
      const response = await axios.get<BusinessUnit[]>(`${API_BASE}/api/business-units`);
      return response.data;
    },
    staleTime: 30000,
  });
}

export function useBusinessUnitsByCompany(companyId: string | null) {
  return useQuery<BusinessUnit[]>({
    queryKey: ["businessUnits", companyId],
    queryFn: async () => {
      const response = await axios.get<BusinessUnit[]>(`${API_BASE}/api/business-units`);
      return response.data.filter((bu) => bu.companyId === companyId);
    },
    enabled: !!companyId,
    staleTime: 30000,
  });
}

export function useBusinessUnitsFlat(companyId: string | null) {
  return useQuery<BusinessUnitWithChildren[]>({
    queryKey: ["businessUnitsFlat", companyId],
    queryFn: async () => {
      const url = companyId 
        ? `${API_BASE}/api/business-units/flat?companyId=${companyId}`
        : `${API_BASE}/api/business-units/flat`;
      const response = await axios.get<BusinessUnitWithChildren[]>(url);
      return response.data;
    },
    enabled: !!companyId,
    staleTime: 30000,
  });
}

export function useProcesses(businessUnitId?: string, companyId?: string) {
  return useQuery<ProcessRecord[]>({
    queryKey: ["processes", businessUnitId ?? companyId ?? "all"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (businessUnitId) {
        params.businessUnitId = businessUnitId;
      } else if (companyId) {
        params.companyId = companyId;
      }
      const response = await axios.get<ProcessRecord[]>(`${API_BASE}/api/processes`, { params });
      return response.data;
    },
    staleTime: 30000,
  });
}

export function useProcessesByBusinessUnit(businessUnitId: string | null) {
  return useQuery<ProcessRecord[]>({
    queryKey: ["processes", businessUnitId],
    queryFn: async () => {
      const response = await axios.get<ProcessRecord[]>(`${API_BASE}/api/processes`);
      return response.data.filter((p) => p.businessUnitId === businessUnitId);
    },
    enabled: !!businessUnitId,
    staleTime: 30000,
  });
}

export function useAllProcesses() {
  return useQuery<ProcessRecord[]>({
    queryKey: ["processes", "all"],
    queryFn: async () => {
      const response = await axios.get<ProcessRecord[]>(`${API_BASE}/api/processes`);
      return response.data;
    },
    staleTime: 30000,
  });
}

export function useAllBusinessUnits() {
  return useQuery<BusinessUnit[]>({
    queryKey: ["businessUnits", "all"],
    queryFn: async () => {
      const response = await axios.get<BusinessUnit[]>(`${API_BASE}/api/business-units`);
      return response.data;
    },
    staleTime: 30000,
  });
}
