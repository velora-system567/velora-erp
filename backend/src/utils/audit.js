import { getPrisma } from "../config/db.js";

function requestMeta(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  return {
    ipAddress: Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim() || req.ip || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

export async function writeAudit(req, { tx, tableName, recordId, action, oldValue = null, newValue = null }) {
  const prisma = tx || getPrisma();
  const actor = req.user?.sub || null;
  const tenantId = req.tenantId || req.user?.tenantId;
  const companyId = req.companyId || req.user?.companyId;

  if (!tenantId || !companyId || !recordId) return null;

  const meta = requestMeta(req);
  return prisma.auditLog.create({
    data: {
      tenantId,
      companyId,
      branchId: req.branchId || null,
      tableName,
      recordId,
      action,
      oldValue,
      newValue: meta.userAgent || meta.ipAddress ? { ...newValue, _meta: meta } : newValue,
      createdBy: actor,
      updatedBy: actor,
    },
  });
}
