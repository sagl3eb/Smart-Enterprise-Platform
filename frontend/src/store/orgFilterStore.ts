import { create } from "zustand";

interface OrgFilterState {
  // The currently-selected organizationId filter (super_admin only).
  // null = "All organizations" — no filter sent to the backend.
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;
  reset: () => void;
}

const STORAGE_KEY = "sep-org-filter";

const getStoredFilter = (): string | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && stored !== "null" ? stored : null;
  } catch { return null; }
};

const useOrgFilterStore = create<OrgFilterState>((set) => ({
  selectedOrgId: getStoredFilter(),

  setSelectedOrgId: (id) => {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
    set({ selectedOrgId: id });
  },

  reset: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ selectedOrgId: null });
  },
}));

export default useOrgFilterStore;
