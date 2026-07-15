import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    return next(error);
  }

  try {
    req.user = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    req.tenantId = req.user.tenantId;
    req.companyId = req.user.companyId;
    req.branchId = req.headers["x-branch-id"] || null;
    return next();
  } catch {
    const error = new Error("Invalid or expired token");
    error.statusCode = 401;
    return next(error);
  }
}

/**
 * Checks that the authenticated user holds the given permission.
 * Owners ("*") bypass all checks.
 * @param {string|string[]} permission - single key or array (ANY match grants access)
 */
export function requirePermission(permission) {
  const required = Array.isArray(permission) ? permission : [permission];
  return (req, res, next) => {
    const perms = req.user?.permissions || [];
    const granted =
      perms.includes("*") || required.some((p) => perms.includes(p));
    if (!granted) {
      const error = new Error(`Permission denied. Required: ${required.join(" or ")}`);
      error.statusCode = 403;
      return next(error);
    }
    return next();
  };
}
