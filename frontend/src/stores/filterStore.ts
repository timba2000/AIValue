import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FilterState {
  selectedCompanyId: string;
  selectedBusinessUnitId: string;
  selectedProcessId: string;
  setSelectedCompanyId: (id: string) => void;
  setSelectedBusinessUnitId: (id: string) => void;
  setSelectedProcessId: (id: string) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      selectedCompanyId: '',
      selectedBusinessUnitId: '',
      selectedProcessId: '',
      setSelectedCompanyId: (id: string) => set({ 
        selectedCompanyId: id, 
        selectedBusinessUnitId: '', 
        selectedProcessId: '' 
      }),
      setSelectedBusinessUnitId: (id: string) => set({ 
        selectedBusinessUnitId: id, 
        selectedProcessId: '' 
      }),
      setSelectedProcessId: (id: string) => set({ 
        selectedProcessId: id 
      }),
      clearFilters: () => set({ 
        selectedCompanyId: '', 
        selectedBusinessUnitId: '', 
        selectedProcessId: '' 
      }),
    }),
    {
      name: 'filter-context-storage',
    }
  )
);
