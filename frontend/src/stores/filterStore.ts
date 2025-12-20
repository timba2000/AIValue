import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PainPointFilterType = 'all' | 'linked' | 'unlinked';

interface FilterState {
  selectedCompanyId: string;
  selectedBusinessUnitId: string;
  selectedProcessId: string;
  painPointFilter: PainPointFilterType;
  setSelectedCompanyId: (id: string) => void;
  setSelectedBusinessUnitId: (id: string) => void;
  setSelectedProcessId: (id: string) => void;
  setPainPointFilter: (filter: PainPointFilterType) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      selectedCompanyId: '',
      selectedBusinessUnitId: '',
      selectedProcessId: '',
      painPointFilter: 'all' as PainPointFilterType,
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
      setPainPointFilter: (filter: PainPointFilterType) => set({
        painPointFilter: filter
      }),
      clearFilters: () => set({ 
        selectedCompanyId: '', 
        selectedBusinessUnitId: '', 
        selectedProcessId: '',
        painPointFilter: 'all'
      }),
    }),
    {
      name: 'filter-context-storage',
    }
  )
);
