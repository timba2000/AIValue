import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AISettingsState {
  aiEnabled: boolean;
  setAiEnabled: (enabled: boolean) => void;
  toggleAi: () => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      aiEnabled: false,
      setAiEnabled: (enabled: boolean) => set({ aiEnabled: enabled }),
      toggleAi: () => set((state) => ({ aiEnabled: !state.aiEnabled })),
    }),
    {
      name: 'ai-settings-storage',
    }
  )
);
