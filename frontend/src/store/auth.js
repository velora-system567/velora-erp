import { create } from "zustand";

const TOKEN_KEYS = ["velora_access_token", "velora_refresh_token", "velora_user"];
const SESSION_META_KEY = "velora_session_meta";

function readSessionMeta() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_META_KEY) || "null");
  } catch {
    return null;
  }
}

export const useAuthStore = create((set) => ({
  user: (() => { try { return JSON.parse(localStorage.getItem("velora_user") || "null"); } catch { return null; } })(),
  // Auth hydration state: "idle" | "checking" | "ready"
  // ProtectedRoute waits for "ready" before allowing access or redirecting.
  // This prevents the app from redirecting an authenticated user to /login
  // before the existing session has been restored.
  authState: "idle",
  sessionType: readSessionMeta()?.sessionType || null,
  sessionExpiresAt: readSessionMeta()?.expiresAt || null,

  // Apply a freshly issued session to storage + store.
  setSession: ({ user, accessToken, refreshToken, sessionType, sessionExpiresAt }) => {
    if (!accessToken || !refreshToken || !user) return;
    localStorage.setItem("velora_access_token", accessToken);
    localStorage.setItem("velora_refresh_token", refreshToken);
    localStorage.setItem("velora_user", JSON.stringify(user));
    const meta = {
      sessionType: sessionType || "session",
      expiresAt: sessionExpiresAt || null,
    };
    localStorage.setItem(SESSION_META_KEY, JSON.stringify(meta));
    set({ user, sessionType: meta.sessionType, sessionExpiresAt: meta.expiresAt, authState: "ready" });
  },

  /**
   * Sync the in-memory user state from localStorage.
   * Called after a silent token refresh so the Zustand store doesn't go stale.
   */
  syncFromStorage: () => {
    try {
      const user = JSON.parse(localStorage.getItem("velora_user") || "null");
      const meta = readSessionMeta();
      set({
        user,
        sessionType: meta?.sessionType || null,
        sessionExpiresAt: meta?.expiresAt || null,
      });
    } catch { /* ignore corrupted data */ }
  },

  markReady: () => set({ authState: "ready" }),
  markChecking: () => set({ authState: "checking" }),

  clearSession: () => {
    TOKEN_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(SESSION_META_KEY);
    set({ user: null, sessionType: null, sessionExpiresAt: null, authState: "ready" });
  },
}));

// ─── Auth hydration ─────────────────────────────────────────────────────────
// Single source of truth for "is the session valid on first load?".
// ROOT CAUSE FIX: previously ProtectedRoute read the ACCESS token's expiry and
// destroyed the session + redirected to /login whenever it was expired — even
// though the refresh token (7d, or 15d persistent) was still valid. That is what
// caused "login again every day": the access token lives only 8h, so returning
// "another day" always bounced users to login despite a live refresh token.
//
// Now we NEVER treat "access token expired on first render" as logged-out.
// We first try a silent refresh. Only when the refresh fails do we clear.
//
// IMPORTANT: We use the shared silentTokenRefresh() from api.js (not our own
// fetch) so that app-startup hydration and runtime 401-retry never race
// against each other with two concurrent POST /auth/refresh-token calls.

let _initPromise = null;

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? Date.now() >= payload.exp * 1000 : false;
  } catch {
    return false;
  }
}

export function getIsAuthenticated() {
  const accessToken = localStorage.getItem("velora_access_token");
  if (!accessToken) return false;
  if (!isTokenExpired(accessToken)) return true;
  return Boolean(localStorage.getItem("velora_refresh_token"));
}

/**
 * Ensure the app has a valid access token before rendering protected pages.
 * Returns true when the user is authenticated (may be a result of a silent
 * refresh), false when no valid session exists.
 */
export async function ensureAuthenticated({ forceRefresh = false } = {}) {
  const store = useAuthStore.getState();
  const accessToken = localStorage.getItem("velora_access_token");

  // No session at all → not authenticated.
  if (!accessToken && !localStorage.getItem("velora_refresh_token")) {
    store.clearSession();
    return false;
  }

  // Access token still valid → authenticated (optionally ensure a fresh session).
  if (accessToken && !isTokenExpired(accessToken) && !forceRefresh) {
    store.markReady();
    return true;
  }

  // Access token missing/expired but refresh token present → try silent refresh.
  // Guard against duplicate concurrent init calls.
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem("velora_refresh_token");
      if (!refreshToken) {
        useAuthStore.getState().clearSession();
        return false;
      }
      // Use the SHARED refresh from api.js — same promise as the 401
      // interceptor, so two concurrent refreshes are impossible.
      const { silentTokenRefresh } = await import("../services/api.js");
      const newAccessToken = await silentTokenRefresh();
      if (!newAccessToken) {
        useAuthStore.getState().clearSession();
        return false;
      }
      useAuthStore.getState().markReady();
      return true;
    } catch {
      useAuthStore.getState().clearSession();
      return false;
    } finally {
      _initPromise = null;
    }
  })();
  return _initPromise;
}
