export function requireTenant(req, res, next) {
  if (!req.tenantId) {
    const error = new Error("Tenant context is required");
    error.statusCode = 400;
    return next(error);
  }

  return next();
}
