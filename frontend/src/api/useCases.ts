import axios from "axios";
import type { UseCase, UseCasePayload } from "@/types/useCase";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export const getUseCases = async (): Promise<UseCase[]> => {
  const response = await axios.get<UseCase[]>(`${API_BASE}/api/use-cases`);
  return response.data;
};

export const createUseCase = async (payload: UseCasePayload): Promise<UseCase> => {
  const response = await axios.post<UseCase>(`${API_BASE}/api/use-cases`, payload);
  return response.data;
};

export const updateUseCase = async (
  id: string,
  payload: UseCasePayload
): Promise<UseCase> => {
  const response = await axios.put<UseCase>(`${API_BASE}/api/use-cases/${id}`, payload);
  return response.data;
};

export const deleteUseCase = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE}/api/use-cases/${id}`);
};
