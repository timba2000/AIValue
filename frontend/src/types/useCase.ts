export interface UseCase {
  id: string;
  title: string;
  problem: string;
  embedding: number[] | null;
  industry: string | null;
  pattern: string | null;
  automationLevel: string | null;
  classificationConfidence: number | null;
  hoursSavedPerOccurrence: number;
  occurrencesPerMonth: number;
  valuePerHour: number;
  valueScore: number;
  createdAt: string;
}

export interface CreateUseCasePayload {
  title: string;
  problem: string;
  hoursSavedPerOccurrence: number;
  occurrencesPerMonth: number;
  valuePerHour: number;
}

export type ApiUseCase = Omit<
  UseCase,
  "classificationConfidence" | "hoursSavedPerOccurrence" | "occurrencesPerMonth" | "valuePerHour" | "valueScore"
> & {
  classificationConfidence: string | number | null;
  hoursSavedPerOccurrence: string | number;
  occurrencesPerMonth: string | number;
  valuePerHour: string | number;
  valueScore: string | number;
};
