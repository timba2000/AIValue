export interface UseCase {
  id: string;
  title: string;
  problem: string;
  embedding: number[] | null;
  createdAt: string;
}

export interface CreateUseCasePayload {
  title: string;
  problem: string;
}
