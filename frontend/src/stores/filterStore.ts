import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PainPointFilterType = 'all' | 'linked' | 'unlinked';

interface FilterState {
  selectedCompanyId: string;
  selectedBusinessUnitId: string;
  selectedProcessId: string;
  selectedL1Process: string;
  selectedL2Process: string;
  painPointFilter: PainPointFilterType;
  setSelectedCompanyId: (id: string) => void;
  setSelectedBusinessUnitId: (id: string) => void;
  setSelectedProcessId: (id: string) => void;
  setSelectedL1Process: (l1: string) => void;
  setSelectedL2Process: (l2: string) => void;
  setPainPointFilter: (filter: PainPointFilterType) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      selectedCompanyId: '',
      selectedBusinessUnitId: '',
      selectedProcessId: '',
      selectedL1Process: '',
      selectedL2Process: '',
      painPointFilter: 'all' as PainPointFilterType,
      setSelectedCompanyId: (id: string) => set({ 
        selectedCompanyId: id, 
        selectedBusinessUnitId: '', 
        selectedProcessId: '',
        selectedL1Process: '',
        selectedL2Process: ''
      }),
      setSelectedBusinessUnitId: (id: string) => set({ 
        selectedBusinessUnitId: id, 
        selectedProcessId: '',
        selectedL1Process: '',
        selectedL2Process: ''
      }),
      setSelectedProcessId: (id: string) => set({ 
        selectedProcessId: id 
      }),
      setSelectedL1Process: (l1: string) => set({ 
        selectedL1Process: l1,
        selectedL2Process: '',
        selectedProcessId: ''
      }),
      setSelectedL2Process: (l2: string) => set({ 
        selectedL2Process: l2,
        selectedProcessId: ''
      }),
      setPainPointFilter: (filter: PainPointFilterType) => set({
        painPointFilter: filter
      }),
      clearFilters: () => set({ 
        selectedCompanyId: '', 
        selectedBusinessUnitId: '', 
        selectedProcessId: '',
        selectedL1Process: '',
        selectedL2Process: '',
        painPointFilter: 'all'
      }),
    }),
    {
      name: 'filter-context-storage',
    }
  )
);
