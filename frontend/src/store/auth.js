import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: null,
  setSession: ({ user, accessToken, refreshToken }) => {
    localStorage.setItem("velora_access_token", accessToken);
    localStorage.setItem("velora_refresh_token", refreshToken);
    set({ user });
  },
  clearSession: () => {
    localStorage.removeItem("velora_access_token");
    localStorage.removeItem("velora_refresh_token");
    set({ user: null });
  },
}));
