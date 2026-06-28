import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem("velora_user") || "null"),
  setSession: ({ user, accessToken, refreshToken }) => {
    localStorage.setItem("velora_access_token", accessToken);
    localStorage.setItem("velora_refresh_token", refreshToken);
    localStorage.setItem("velora_user", JSON.stringify(user));
    set({ user });
  },
  clearSession: () => {
    localStorage.removeItem("velora_access_token");
    localStorage.removeItem("velora_refresh_token");
    localStorage.removeItem("velora_user");
    set({ user: null });
  },
}));
