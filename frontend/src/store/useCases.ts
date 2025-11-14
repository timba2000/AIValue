import axios from "axios";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { CreateUseCasePayload, UseCase } from "@/types/useCase";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

interface UseCaseState {
  useCases: UseCase[];
  loading: boolean;
  error: string | null;
  fetchUseCases: () => Promise<void>;
  addUseCase: (payload: CreateUseCasePayload) => Promise<void>;
}

export const useUseCaseStore = create<UseCaseState>()(
  immer((set) => ({
    useCases: [],
    loading: false,
    error: null,
    fetchUseCases: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });
      try {
        const response = await axios.get<UseCase[]>(`${API_BASE}/usecases`);
        set((state) => {
          state.useCases = response.data;
        });
      } catch (error) {
        console.error(error);
        set((state) => {
          state.error = "Failed to load use cases";
        });
      } finally {
        set((state) => {
          state.loading = false;
        });
      }
    },
    addUseCase: async (payload: CreateUseCasePayload) => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });
      try {
        const response = await axios.post<UseCase>(`${API_BASE}/usecases`, payload);
        set((state) => {
          state.useCases.unshift(response.data);
        });
      } catch (error) {
        console.error(error);
        set((state) => {
          state.error = "Failed to create use case";
        });
        throw error;
      } finally {
        set((state) => {
          state.loading = false;
        });
      }
    }
  }))
);
