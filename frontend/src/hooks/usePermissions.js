/**
 * usePermissions — Frontend permission hooks.
 *
 * Checks permissions client-side for UI rendering (buttons, menus, pages).
 * The BACKEND always enforces permissions server-side — never trust the client.
 *
 * Permission keys follow the format: "module:action" (e.g., "sales:view", "admin:manageRoles")
 */
import { create } from "zustand";
import { apiRequest } from "../services/api";

// ─── Permission Store ───────────────────────────────────────────────────────

export const usePermissionStore = create((set) => ({
  permissions: [],
  loaded: false,
  setPermissions: (perms) => set({ permissions: perms, loaded: true }),
  clearPermissions: () => set({ permissions: [], loaded: false }),
}));

const MAX_AUTH_RETRIES = 3;

/**
 * Read the permission claim embedded in the access token (JWT) in
 * localStorage, if any.  Returns null when there is no token, no parseable
 * claim, or an empty claim.  Used only as an instant render fallback — the
 * authoritative source is always the backend (/auth/me).
 */
export function permissionsFromJwt() {
  try {
    const token = localStorage.getItem("velora_access_token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (Array.isArray(payload.permissions) && payload.permissions.length) {
      return payload.permissions;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Load current user's permissions from the backend (authoritative).
 *
 * Retries transient failures with backoff (bounded) so a cold-start request
 * failure — e.g. the serverless function still establishing its DB connection
 * — does not permanently strand the app in an unloaded permission state.
 *
 * Returns:
 *   - array  → authoritative response (may be empty — respect it)
 *   - null   → terminal failure (network/5xx), caller should fall back
 */
export async function fetchUserPermissions(attempt = 1) {
  try {
    const res = await apiRequest("/auth/me");
    return res.data?.user?.permissions || [];
  } catch {
    if (attempt < MAX_AUTH_RETRIES) {
      await new Promise((r) => setTimeout(r, Math.min(attempt * 800, 2000)));
      return fetchUserPermissions(attempt + 1);
    }
    return null;
  }
}

/**
 * Initialize the permission store.  Guarantees `loaded` becomes true in every
 * outcome, so the app NEVER deadlocks in a blank "waiting for permissions"
 * state (which previously happened when /auth/me failed on a cold start AND
 * the JWT carried no usable permission claim).
 *
 * Priority:
 *   1. JWT claim — applied synchronously so the UI renders immediately while
 *      the authoritative fetch is in flight (no blank waiting window).
 *   2. /auth/me (with bounded retries) — server truth; overrides the JWT
 *      claim when it arrives.
 *   3. [] — only if both sources yield nothing; shows a diagnosable
 *      "no access" state instead of a permanent blank page.
 */
export async function initPermissions() {
  const store = usePermissionStore.getState();
  if (store.loaded) return;

  const jwtPerms = permissionsFromJwt();
  if (jwtPerms) store.setPermissions(jwtPerms);

  const serverPerms = await fetchUserPermissions();
  if (serverPerms) {
    store.setPermissions(serverPerms);
  } else if (!jwtPerms) {
    store.setPermissions([]);
  }
}

/**
 * Initialize permissions on app load (legacy hook kept for compatibility).
 * Prefer the async initPermissions() in AppShell.
 */
export function useInitPermissions() {
  const { loaded } = usePermissionStore();
  if (!loaded) {
    const jwtPerms = permissionsFromJwt();
    if (jwtPerms) usePermissionStore.getState().setPermissions(jwtPerms);
  }
}

// ─── Permission Checks ──────────────────────────────────────────────────────

/**
 * Check if user has a specific permission.
 */
export function useHasPermission(permissionKey) {
  const permissions = usePermissionStore((s) => s.permissions);
  if (!permissionKey) return true;
  if (permissions.includes("*")) return true;
  return permissions.includes(permissionKey);
}

/**
 * Check if user has ANY of the given permissions.
 */
export function useHasAnyPermission(permissionKeys) {
  const permissions = usePermissionStore((s) => s.permissions);
  if (permissions.includes("*")) return true;
  return permissionKeys.some((k) => permissions.includes(k));
}

/**
 * Check if user has ALL of the given permissions.
 */
export function useHasAllPermissions(permissionKeys) {
  const permissions = usePermissionStore((s) => s.permissions);
  if (permissions.includes("*")) return true;
  return permissionKeys.every((k) => permissions.includes(k));
}

/**
 * Check if user can view a module (for sidebar).
 */
export function useCanViewModule(moduleName) {
  return useHasPermission(`${moduleName}:view`);
}

// ─── Module Visibility ──────────────────────────────────────────────────────

/**
 * Returns which modules the user can see. Used by the sidebar.
 */
export function useVisibleModules() {
  const permissions = usePermissionStore((s) => s.permissions);
  const isSuperAdmin = permissions.includes("*");

  // `permissionKey` mirrors the exact permission key the BACKEND enforces for
  // each module. Keeping them in sync here means the sidebar shows exactly what
  // the API will allow — no "ghost" modules that 403 on navigation.
  const ALL_MODULES = [
    { key: "dashboard", permissionKey: "dashboard:view", path: "/", label: "Dashboard", sidebarLabel: "Home", icon: "LayoutDashboard", category: "home" },
    { key: "sales", permissionKey: "sales:view", path: "/sales", label: "Sales", sidebarLabel: "Sales", icon: "ShoppingCart", category: "sell" },
    { key: "crm", permissionKey: "crm:view", path: "/crm", label: "CRM", sidebarLabel: "Customers", icon: "Users", category: "sell" },
    { key: "purchase", permissionKey: "purchase:view", path: "/purchase", label: "Procurement", sidebarLabel: "Purchasing", icon: "Package", category: "buy" },
    { key: "inventory", permissionKey: "inventory:view", path: "/inventory", label: "Inventory", sidebarLabel: "Inventory", icon: "Warehouse", category: "products" },
    { key: "manufacturing", permissionKey: "manufacturing:view", path: "/manufacturing", label: "Manufacturing", sidebarLabel: "Manufacturing", icon: "Factory", category: "products" },
    { key: "accounts", permissionKey: "accounts:view", path: "/accounts", label: "Finance", sidebarLabel: "Finance", icon: "DollarSign", category: "money" },
    { key: "hrms", permissionKey: "hr:view", path: "/hrms", label: "HR", sidebarLabel: "People", icon: "UserCheck", category: "people" },
    { key: "eam", permissionKey: "eam:view", path: "/eam", label: "Assets", sidebarLabel: "Assets", icon: "Tool", category: "company" },
    { key: "reports", permissionKey: "reports:view", path: "/executive", label: "Reports", sidebarLabel: "Reports", icon: "BarChart", category: "company" },
    { key: "audit", permissionKey: "audit:view", path: "/activity", label: "Audit", sidebarLabel: "Audit", icon: "ClipboardCheck", category: "company" },
    { key: "settings", permissionKey: "settings:view", path: "/settings", label: "Settings", sidebarLabel: "Settings", icon: "Settings", category: "settings" },
    { key: "admin", permissionKey: "admin:view", path: "/admin", label: "Administration", sidebarLabel: "Administration", icon: "Shield", category: "settings" },
  ];

  if (isSuperAdmin) return ALL_MODULES;

  return ALL_MODULES.filter((mod) => {
    if (mod.key === "dashboard") return true; // Everyone can see dashboard
    return permissions.includes(mod.permissionKey);
  });
}
