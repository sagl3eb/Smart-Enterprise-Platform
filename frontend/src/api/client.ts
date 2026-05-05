import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import useAuthStore from "../store/authStore";
import useOrgFilterStore from "../store/orgFilterStore";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
const ML_BASE = import.meta.env.VITE_ML_API_BASE_URL || "http://localhost:8000";

// ─── Main API Client ───────────────────────────────────────

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  // For super_admin, inject the selected organizationId filter as a query param
  // so the backend's attachScope middleware narrows reads to that org. Skip the
  // injection when the caller has already set an `organizationId` key in params
  // (including the empty string) — that means the page wants explicit control.
  const user = useAuthStore.getState().user;
  if (user?.role?.name === "super_admin") {
    const callerParams = (config.params || {}) as Record<string, unknown>;
    const callerSpecifiedOrg = Object.prototype.hasOwnProperty.call(callerParams, "organizationId");
    if (!callerSpecifiedOrg) {
      const selectedOrgId = useOrgFilterStore.getState().selectedOrgId;
      if (selectedOrgId) {
        config.params = { ...callerParams, organizationId: selectedOrgId };
      }
    }
  }

  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Don't attempt token refresh on the login or refresh endpoints themselves;
    // let the caller handle the error (e.g. show "Invalid email or password").
    const url = originalRequest?.url || "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/refresh");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const tokens = useAuthStore.getState().tokens;
      if (!tokens?.refreshToken) {
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE}/auth/refresh`, {
          refreshToken: tokens.refreshToken,
        });

        const newTokens = response.data.data;
        useAuthStore.getState().setTokens(newTokens);

        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        processQueue(null, newTokens.accessToken);

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── ML API Client ─────────────────────────────────────────

const mlApi = axios.create({
  baseURL: ML_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

export { api, mlApi };
export default api;
