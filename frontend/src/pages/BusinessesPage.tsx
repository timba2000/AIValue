import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { BusinessUnitList } from "@/components/business/BusinessUnitList";
import { BusinessUnitModal } from "@/components/business/BusinessUnitModal";
import { CompanyList } from "@/components/business/CompanyList";
import { CompanyModal } from "@/components/business/CompanyModal";
import type { BusinessUnit, Company, BusinessUnitPayload, CompanyPayload } from "@/types/business";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export default function BusinessesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingUnit, setEditingUnit] = useState<BusinessUnit | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<BusinessUnit | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    setError(null);
    try {
      const response = await axios.get<Company[]>(`${API_BASE}/api/companies`);
      setCompanies(response.data);
    } catch (error) {
      console.error(error);
      setError("Failed to load companies");
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  const fetchBusinessUnits = useCallback(async (companyId: string) => {
    setLoadingUnits(true);
    setError(null);
    try {
      const response = await axios.get<BusinessUnit[]>(`${API_BASE}/api/companies/${companyId}/business-units`);
      setBusinessUnits(response.data);
    } catch (error) {
      console.error(error);
      setError("Failed to load business units");
    } finally {
      setLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      const firstCompany = companies[0];
      setSelectedCompanyId(firstCompany.id);
      fetchBusinessUnits(firstCompany.id);
    }
  }, [companies, fetchBusinessUnits, selectedCompanyId]);

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    fetchBusinessUnits(companyId);
  };

  const handleSaveCompany = async (payload: CompanyPayload) => {
    setError(null);
    if (editingCompany) {
      await axios.put(`${API_BASE}/api/companies/${editingCompany.id}`, payload);
    } else {
      await axios.post(`${API_BASE}/api/companies`, payload);
    }
    await fetchCompanies();
    setEditingCompany(null);
  };

  const handleSaveBusinessUnit = async (payload: BusinessUnitPayload) => {
    if (!selectedCompanyId) return;
    setError(null);
    if (editingUnit) {
      await axios.put(`${API_BASE}/api/business-units/${editingUnit.id}`, payload);
    } else {
      await axios.post(`${API_BASE}/api/business-units`, payload);
    }
    await fetchBusinessUnits(selectedCompanyId);
    setEditingUnit(null);
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      await axios.delete(`${API_BASE}/api/companies/${companyToDelete.id}`);
      setCompanyToDelete(null);
      await fetchCompanies();
      setBusinessUnits([]);
      if (selectedCompanyId === companyToDelete.id) {
        setSelectedCompanyId(null);
      }
    } catch (error) {
      console.error(error);
      setError("Failed to delete company");
    }
  };

  const handleDeleteUnit = async () => {
    if (!unitToDelete || !selectedCompanyId) return;
    try {
      await axios.delete(`${API_BASE}/api/business-units/${unitToDelete.id}`);
      setUnitToDelete(null);
      await fetchBusinessUnits(selectedCompanyId);
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ?? "Failed to delete business unit"
        : "Failed to delete business unit";
      setError(message);
    }
  };

  const openCreateCompanyModal = () => {
    setEditingCompany(null);
    setCompanyModalOpen(true);
  };

  const openEditCompanyModal = (company: Company) => {
    setEditingCompany(company);
    setCompanyModalOpen(true);
  };

  const openCreateUnitModal = () => {
    if (!selectedCompanyId) return;
    setEditingUnit(null);
    setUnitModalOpen(true);
  };

  const openEditUnitModal = (unit: BusinessUnit) => {
    setEditingUnit(unit);
    setUnitModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Businesses</h1>
            <p className="text-sm text-gray-600 mt-1">Manage companies, their business units, and FTEs.</p>
          </div>
          {error ? <p className="text-sm text-red-600 font-medium">{error}</p> : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <CompanyList
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          onSelect={handleSelectCompany}
          onAdd={openCreateCompanyModal}
          onEdit={openEditCompanyModal}
          onDelete={setCompanyToDelete}
          loading={loadingCompanies}
        />
        <BusinessUnitList
          company={selectedCompany}
          businessUnits={businessUnits}
          onAdd={openCreateUnitModal}
          onEdit={openEditUnitModal}
          onDelete={setUnitToDelete}
          loading={loadingUnits}
        />
      </div>

      <CompanyModal
        open={companyModalOpen}
        onOpenChange={(open) => {
          setCompanyModalOpen(open);
          if (!open) setEditingCompany(null);
        }}
        onSubmit={handleSaveCompany}
        initialCompany={editingCompany}
      />

      {selectedCompanyId ? (
        <BusinessUnitModal
          open={unitModalOpen}
          onOpenChange={(open) => {
            setUnitModalOpen(open);
            if (!open) setEditingUnit(null);
          }}
          onSubmit={(payload) => handleSaveBusinessUnit({ ...payload, companyId: selectedCompanyId })}
          initialUnit={editingUnit}
          companyId={selectedCompanyId}
        />
      ) : null}

      <AlertDialog open={companyToDelete !== null} onOpenChange={(open) => !open && setCompanyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the company and all of its business units. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setCompanyToDelete(null)}>
              Cancel
            </Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteCompany}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unitToDelete !== null} onOpenChange={(open) => !open && setUnitToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete business unit</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting this business unit will remove it from your organisational model and may impact existing process mappings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setUnitToDelete(null)}>
              Cancel
            </Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteUnit}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
