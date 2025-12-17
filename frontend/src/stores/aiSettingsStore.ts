import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AISettingsState {
  aiEnabled: boolean;
  persona: string;
  rules: string;
  setAiEnabled: (enabled: boolean) => void;
  toggleAi: () => void;
  setPersona: (persona: string) => void;
  setRules: (rules: string) => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      aiEnabled: false,
      persona: '',
      rules: '',
      setAiEnabled: (enabled: boolean) => set({ aiEnabled: enabled }),
      toggleAi: () => set((state) => ({ aiEnabled: !state.aiEnabled })),
      setPersona: (persona: string) => set({ persona }),
      setRules: (rules: string) => set({ rules }),
    }),
    {
      name: 'ai-settings-storage',
    }
  )
);
