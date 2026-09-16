import { getPrisma } from "../config/db.js";

export function requireTenant(req, res, next) {
  if (!req.tenantId || !req.companyId) {
    const error = new Error("Tenant/company context is required");
    error.statusCode = 400;
    return next(error);
  }

  req.tenantCompanyScope = { tenantId: req.tenantId, companyId: req.companyId };
  return next();
}

export function requireTenantMembership() {
  return async (req, res, next) => {
    try {
      const prisma = getPrisma();
      const [membership] = await prisma.userRole.findMany({
        where: {
          userId: req.user?.sub,
          tenantId: req.tenantId,
          companyId: req.companyId,
          isDeleted: false,
        },
        take: 1,
        select: { id: true },
      });

      if (!membership) {
        const error = new Error("Tenant membership required");
        error.statusCode = 403;
        return next(error);
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
