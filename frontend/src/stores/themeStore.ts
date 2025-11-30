import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const getSystemTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const resolveTheme = (theme: Theme): "light" | "dark" => {
  if (theme === "system") {
    return getSystemTheme();
  }
  return theme;
};

const applyTheme = (resolvedTheme: "light" | "dark") => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
};

const getInitialTheme = (): { theme: Theme; resolvedTheme: "light" | "dark" } => {
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem("aivalue-theme");
      if (stored) {
        const parsed = JSON.parse(stored);
        const theme = parsed.state?.theme || "system";
        const resolvedTheme = resolveTheme(theme);
        applyTheme(resolvedTheme);
        return { theme, resolvedTheme };
      }
    } catch {}
  }
  const defaultTheme = "system";
  const resolvedTheme = resolveTheme(defaultTheme);
  applyTheme(resolvedTheme);
  return { theme: defaultTheme, resolvedTheme };
};

const initialState = getInitialTheme();

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: initialState.theme,
      resolvedTheme: initialState.resolvedTheme,
      setTheme: (theme: Theme) => {
        const resolvedTheme = resolveTheme(theme);
        applyTheme(resolvedTheme);
        set({ theme, resolvedTheme });
      },
    }),
    {
      name: "aivalue-theme",
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolvedTheme = resolveTheme(state.theme);
          applyTheme(resolvedTheme);
          state.resolvedTheme = resolvedTheme;
        }
      },
    }
  )
);

if (typeof window !== "undefined") {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", (e) => {
    const state = useThemeStore.getState();
    if (state.theme === "system") {
      const newResolvedTheme = e.matches ? "dark" : "light";
      applyTheme(newResolvedTheme);
      useThemeStore.setState({ resolvedTheme: newResolvedTheme });
    }
  });
}
