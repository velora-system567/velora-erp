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

/**
 * Load current user's permissions from the backend.
 */
export async function fetchUserPermissions() {
  try {
    const res = await apiRequest("/auth/me");
    // Permissions are embedded in req.user.permissions after requireAuth middleware
    // falls back to what's in the JWT
    return res.data?.user?.permissions || [];
  } catch {
    return [];
  }
}

/**
 * Initialize permissions on app load.
 */
export function useInitPermissions() {
  const { loaded, setPermissions } = usePermissionStore();

  if (!loaded) {
    // Try to get permissions from the JWT payload (stored in localStorage)
    try {
      const token = localStorage.getItem("velora_access_token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.permissions) {
          setPermissions(payload.permissions);
        }
      }
    } catch {
      // Ignore
    }
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

  const ALL_MODULES = [
    { key: "dashboard", path: "/", label: "Dashboard", icon: "LayoutDashboard" },
    { key: "sales", path: "/sales", label: "Sales", icon: "ShoppingCart" },
    { key: "purchase", path: "/purchase", label: "Procurement", icon: "Package" },
    { key: "inventory", path: "/inventory", label: "Inventory", icon: "Warehouse" },
    { key: "manufacturing", path: "/manufacturing", label: "Manufacturing", icon: "Factory" },
    { key: "accounts", path: "/accounts", label: "Finance", icon: "DollarSign" },
    { key: "crm", path: "/crm", label: "CRM", icon: "Users" },
    { key: "hrms", path: "/hrms", label: "HR", icon: "UserCheck" },
    { key: "eam", path: "/eam", label: "Assets", icon: "Tool" },
    { key: "reports", path: "/executive", label: "Reports", icon: "BarChart" },
    { key: "audit", path: "/activity", label: "Audit", icon: "ClipboardCheck" },
    { key: "settings", path: "/settings", label: "Settings", icon: "Settings" },
    { key: "admin", path: "/admin", label: "Administration", icon: "Shield" },
  ];

  if (isSuperAdmin) return ALL_MODULES;

  return ALL_MODULES.filter((mod) => {
    if (mod.key === "dashboard") return true; // Everyone can see dashboard
    return permissions.includes(`${mod.key}:view`);
  });
}
