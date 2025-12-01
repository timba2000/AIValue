export interface Company {
  id: string;
  name: string;
  industry: string | null;
  anzsic: string | null;
  createdAt: string;
}

export interface BusinessUnit {
  id: string;
  companyId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  fte: number;
  createdAt: string;
}

export interface BusinessUnitWithChildren extends BusinessUnit {
  children: BusinessUnitWithChildren[];
  depth: number;
}

export interface CompanyPayload {
  name: string;
  industry?: string;
  anzsic?: string;
}

export interface BusinessUnitPayload {
  companyId: string;
  parentId?: string | null;
  name: string;
  fte: number;
  description?: string;
}
