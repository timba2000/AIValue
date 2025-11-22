import axios from "axios";
import type { ProcessRecord } from "@/types/process";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export const getProcesses = async (): Promise<ProcessRecord[]> => {
  const response = await axios.get<ProcessRecord[]>(`${API_BASE}/api/processes`);
  return response.data;
};
