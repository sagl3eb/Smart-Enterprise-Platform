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
  setAuth: (user: AuthUser, tokens: AuthTokens, remember?: boolean) => void;
  setUser: (user: AuthUser) => void;
  setTokens: (tokens: AuthTokens) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  hasModuleAccess: (moduleName: string) => boolean;
  isSuperAdmin: () => boolean;
  canWriteModule: () => boolean;
}

// Persistence helpers — `remember = true` writes to localStorage (survives a
// browser restart); otherwise sessionStorage (cleared on tab close).
const TOKENS_KEY = "sep-tokens";
const USER_KEY = "sep-user";
const REMEMBER_KEY = "sep-remember";

function readStorage(key: string): string | null {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function writeStorage(key: string, value: string, remember: boolean) {
  if (remember) {
    localStorage.setItem(key, value);
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  }
}

function clearStorage() {
  for (const key of [TOKENS_KEY, USER_KEY, REMEMBER_KEY]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

function rememberFlag(): boolean {
  return readStorage(REMEMBER_KEY) === "true";
}

const getStoredTokens = (): AuthTokens | null => {
  try {
    const stored = readStorage(TOKENS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

const getStoredUser = (): AuthUser | null => {
  try {
    const stored = readStorage(USER_KEY);
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

  setAuth: (user, tokens, remember = true) => {
    writeStorage(TOKENS_KEY, JSON.stringify(tokens), remember);
    writeStorage(USER_KEY, JSON.stringify(user), remember);
    writeStorage(REMEMBER_KEY, String(remember), remember);
    set({ user, tokens, isAuthenticated: true });
  },

  setUser: (user) => {
    writeStorage(USER_KEY, JSON.stringify(user), rememberFlag());
    set({ user });
  },

  setTokens: (tokens) => {
    writeStorage(TOKENS_KEY, JSON.stringify(tokens), rememberFlag());
    set({ tokens });
  },

  logout: () => {
    clearStorage();
    set({ user: null, tokens: null, isAuthenticated: false });
  },

  setLoading: (isLoading) => set({ isLoading }),

  hasModuleAccess: (moduleName: string) => {
    const user = get().user;
    if (!user) return false;
    if (user.role.name === "admin" || user.role.name === "super_admin") return true;
    return user.moduleAccess.includes(moduleName);
  },

  isSuperAdmin: () => get().user?.role.name === "super_admin",

  // Super admin is view-only on module data. Viewers can never write.
  // Everyone else writes as usual (backend gates per-role still apply).
  canWriteModule: () => {
    const role = get().user?.role.name;
    return role !== "super_admin" && role !== "viewer";
  },
}));

export default useAuthStore;
