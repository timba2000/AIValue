export interface PainPoint {
  id: string;
  statement: string;
  impactType: string[] | null;
  businessImpact: string | null;
  magnitude: number | null;
  frequency: number | null;
  timePerUnit: number | null;
  totalHoursPerMonth: number | null;
  fteCount: number | null;
  rootCause: string | null;
  workarounds: string | null;
  dependencies: string | null;
  riskLevel: string | null;
  effortSolving: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PainPointPayload {
  statement: string;
  impactType?: string[] | null;
  businessImpact?: string | null;
  magnitude?: number | null;
  frequency?: number | null;
  timePerUnit?: number | null;
  fteCount?: number | null;
  rootCause?: string | null;
  workarounds?: string | null;
  dependencies?: string | null;
  riskLevel?: string | null;
  effortSolving?: number | null;
}

export type ImpactType = "time_waste" | "quality_issue" | "compliance_risk" | "cost_overrun" | "customer_impact" | "other";
export type RiskLevel = "low" | "medium" | "high" | "critical";
