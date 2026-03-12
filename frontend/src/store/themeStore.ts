import { create } from "zustand";

type ThemeMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

const getStoredTheme = (): ThemeMode => {
  try {
    const stored = localStorage.getItem("nexus-theme");
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

const useThemeStore = create<ThemeState>((set) => ({
  mode: getStoredTheme(),

  toggle: () =>
    set((state) => {
      const newMode = state.mode === "light" ? "dark" : "light";
      localStorage.setItem("nexus-theme", newMode);
      return { mode: newMode };
    }),

  setMode: (mode) => {
    localStorage.setItem("nexus-theme", mode);
    set({ mode });
  },
}));

export default useThemeStore;
