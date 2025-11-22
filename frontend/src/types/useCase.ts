export type ComplexityLevel = "Low" | "Medium" | "High" | "Very High";
export type ConfidenceLevel = "Low" | "Medium" | "High";
export type DeliveryTime = "Quick Win" | "1 to 3 months" | "3 to 6 months" | "6 plus months";
export type CostRange = "Low" | "Medium" | "High" | "Very High";

export interface UseCase {
  id: string;
  name: string;
  description: string | null;
  problemToSolve: string;
  solutionOverview: string;
  expectedBenefits: string | null;
  valueDrivers: string | null;
  complexity: ComplexityLevel;
  dataRequirements: string | null;
  systemsImpacted: string | null;
  risks: string | null;
  estimatedFTEHours: number | null;
  estimatedDeliveryTime: DeliveryTime | null;
  costRange: CostRange | null;
  roiEstimate: string | null;
  confidenceLevel: ConfidenceLevel | null;
  processId: string;
  processName: string | null;
  createdAt: string;
}

export type UseCasePayload = Omit<UseCase, "id" | "processName" | "createdAt">;
