export type ComplexityLevel = "Low" | "Medium" | "High" | "Very High";
export type ConfidenceLevel = "Low" | "Medium" | "High";
export type DeliveryTime = "Quick Win" | "1 to 3 months" | "3 to 6 months" | "6 plus months";
export type CostRange = "Low" | "Medium" | "High" | "Very High";
export type DataRequirement = "Structured" | "Unstructured";
export type RiskLevel = "High" | "Medium" | "Low";
export type AlphaType = "Operational" | "Investing" | "Governance" | "Member";

export interface UseCase {
  id: string;
  name: string;
  solutionProvider: string | null;
  problemToSolve: string;
  solutionOverview: string;
  complexity: ComplexityLevel;
  dataRequirements: DataRequirement[] | null;
  systemsImpacted: string | null;
  risks: RiskLevel | null;
  estimatedDeliveryTime: DeliveryTime | null;
  costRange: CostRange | null;
  confidenceLevel: ConfidenceLevel | null;
  alphaType: AlphaType | null;
  processId: string | null;
  processName: string | null;
  companyId: string | null;
  companyName: string | null;
  businessUnitId: string | null;
  businessUnitName: string | null;
  createdAt: string;
}

export type UseCasePayload = Omit<UseCase, "id" | "processName" | "companyName" | "businessUnitName" | "createdAt">;
