import { create } from "zustand";

interface UserRole {
  id: string;
  name: string;
}

interface UserOrg {
  id: string;
  name: string;
  slug: string;
}

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  role: UserRole;
  organization: UserOrg | null;
  moduleAccess: string[];
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: AuthUser, tokens: AuthTokens) => void;
  setUser: (user: AuthUser) => void;
  setTokens: (tokens: AuthTokens) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  hasModuleAccess: (moduleName: string) => boolean;
}

const getStoredTokens = (): AuthTokens | null => {
  try {
    const stored = localStorage.getItem("sep-tokens");
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

const getStoredUser = (): AuthUser | null => {
  try {
    const stored = localStorage.getItem("sep-user");
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

const storedTokens = getStoredTokens();
const storedUser = getStoredUser();

const useAuthStore = create<AuthState>((set, get) => ({
  user: storedUser,
  tokens: storedTokens,
  isAuthenticated: !!storedTokens && !!storedUser,
  isLoading: false,

  setAuth: (user, tokens) => {
    localStorage.setItem("sep-tokens", JSON.stringify(tokens));
    localStorage.setItem("sep-user", JSON.stringify(user));
    set({ user, tokens, isAuthenticated: true });
  },

  setUser: (user) => {
    localStorage.setItem("sep-user", JSON.stringify(user));
    set({ user });
  },

  setTokens: (tokens) => {
    localStorage.setItem("sep-tokens", JSON.stringify(tokens));
    set({ tokens });
  },

  logout: () => {
    localStorage.removeItem("sep-tokens");
    localStorage.removeItem("sep-user");
    set({ user: null, tokens: null, isAuthenticated: false });
  },

  setLoading: (isLoading) => set({ isLoading }),

  hasModuleAccess: (moduleName: string) => {
    const user = get().user;
    if (!user) return false;
    if (user.role.name === "admin" || user.role.name === "super_admin") return true;
    return user.moduleAccess.includes(moduleName);
  },
}));

export default useAuthStore;
