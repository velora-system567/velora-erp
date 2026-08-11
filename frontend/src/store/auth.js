import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: (() => { try { return JSON.parse(localStorage.getItem("velora_user") || "null"); } catch { return null; } })(),
  setSession: ({ user, accessToken, refreshToken }) => {
    localStorage.setItem("velora_access_token", accessToken);
    localStorage.setItem("velora_refresh_token", refreshToken);
    localStorage.setItem("velora_user", JSON.stringify(user));
    set({ user });
  },
  /**
   * Sync the in-memory user state from localStorage.
   * Called after a silent token refresh (in api.js storeRefreshedSession)
   * so the Zustand store doesn't go stale.
   */
  syncFromStorage: () => {
    try {
      const user = JSON.parse(localStorage.getItem("velora_user") || "null");
      set({ user });
    } catch { /* ignore corrupted data */ }
  },
  clearSession: () => {
    localStorage.removeItem("velora_access_token");
    localStorage.removeItem("velora_refresh_token");
    localStorage.removeItem("velora_user");
    set({ user: null });
  },
}));
