import axios from "axios";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ApiUseCase, CreateUseCasePayload, UseCase } from "@/types/useCase";

const normalizeUseCase = (useCase: ApiUseCase): UseCase => {
  const {
    classificationConfidence,
    hoursSavedPerOccurrence,
    occurrencesPerMonth,
    valuePerHour,
    valueScore,
    ...rest
  } = useCase;

  const numericConfidence =
    classificationConfidence === null || classificationConfidence === undefined
      ? null
      : Number(classificationConfidence);

  const finiteConfidence =
    numericConfidence !== null && Number.isFinite(numericConfidence) ? numericConfidence : null;

  const parseMetric = (value: string | number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    ...rest,
    classificationConfidence: finiteConfidence,
    hoursSavedPerOccurrence: parseMetric(hoursSavedPerOccurrence),
    occurrencesPerMonth: parseMetric(occurrencesPerMonth),
    valuePerHour: parseMetric(valuePerHour),
    valueScore: parseMetric(valueScore)
  };
};

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
        const response = await axios.get<ApiUseCase[]>(`${API_BASE}/usecases`);
        set((state) => {
          state.useCases = response.data.map(normalizeUseCase);
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
        const response = await axios.post<ApiUseCase>(`${API_BASE}/usecases`, payload);
        set((state) => {
          state.useCases.unshift(normalizeUseCase(response.data));
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
