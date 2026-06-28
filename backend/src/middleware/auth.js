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

export function requirePermission(permission) {
  return (req, res, next) => {
    const permissions = req.user?.permissions || [];
    if (!permissions.includes(permission) && !permissions.includes("*")) {
      const error = new Error("Permission denied");
      error.statusCode = 403;
      return next(error);
    }
    return next();
  };
}
