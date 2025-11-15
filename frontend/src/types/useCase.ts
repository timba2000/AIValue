export interface UseCase {
  id: string;
  title: string;
  problem: string;
  embedding: number[] | null;
  industry: string | null;
  pattern: string | null;
  automationLevel: string | null;
  classificationConfidence: number | null;
  createdAt: string;
}

export interface CreateUseCasePayload {
  title: string;
  problem: string;
}

export type ApiUseCase = Omit<UseCase, "classificationConfidence"> & {
  classificationConfidence: string | number | null;
};
