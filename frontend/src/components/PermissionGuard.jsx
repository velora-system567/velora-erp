/**
 * PermissionGuard — Wraps routes to check module-level access.
 *
 * Usage:
 *   <Route element={<PermissionGuard module="admin" requiredPermission="admin:view" />}>
 *     <Route path="/admin" element={<AdminPage />} />
 *   </Route>
 *
 * If the user doesn't have the required permission, they see the 403 page.
 * The BACKEND also enforces permissions — this is only for UI routing.
 */
import { Navigate, Outlet } from "react-router-dom";
import { usePermissionStore } from "../hooks/usePermissions";
import { AccessDenied } from "./AccessDenied";

export function PermissionGuard({ module, requiredPermission, fallback = "accessDenied" }) {
  const permissions = usePermissionStore((s) => s.permissions);
  const loaded = usePermissionStore((s) => s.loaded);

  // Wait for permissions to load
  if (!loaded) return null;

  // Super admin bypass
  if (permissions.includes("*")) return <Outlet />;

  // Check required permission
  const hasAccess = requiredPermission
    ? permissions.includes(requiredPermission)
    : module
      ? permissions.includes(`${module}:view`)
      : true;

  if (!hasAccess) {
    if (fallback === "redirect") {
      return <Navigate to="/" replace />;
    }
    return <AccessDenied moduleName={module || "this section"} />;
  }

  return <Outlet />;
}
