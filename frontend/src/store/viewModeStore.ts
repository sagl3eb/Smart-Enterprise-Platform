import { create } from "zustand";

type ViewMode = "admin" | "employee";

interface ViewModeState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  toggle: () => void;
}

const useViewModeStore = create<ViewModeState>((set) => ({
  mode: "admin",
  setMode: (mode) => set({ mode }),
  toggle: () => set((state) => ({ mode: state.mode === "admin" ? "employee" : "admin" })),
}));

export default useViewModeStore;
