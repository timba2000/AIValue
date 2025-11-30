export interface ProcessRecord {
  id: string;
  businessId: string;
  businessUnitId: string;
  businessUnitName: string | null;
  companyName: string | null;
  name: string;
  description: string | null;
  volume: number | null;
  volumeUnit: string | null;
  fte: number | null;
  owner: string | null;
  painPointCount: number;
  useCaseCount: number;
}

export interface ProcessPayload {
  name: string;
  description?: string;
  volume?: number | null;
  volumeUnit?: string | null;
  fte?: number | null;
  owner?: string | null;
  businessUnitId: string;
  painPointIds?: string[];
  useCaseIds?: string[];
}

export interface PainPointOption {
  id: string;
  statement: string;
}

export interface UseCaseOption {
  id: string;
  name: string;
}

export interface ProcessOptionsResponse {
  painPoints: PainPointOption[];
  useCases: UseCaseOption[];
}
