/**
 * Tenant-safe record mutation helpers.
 *
 * Prisma primary keys are global UUIDs, so mutating by `id` alone is never
 * sufficient in a multi-tenant application. These helpers make ownership part
 * of the write condition and present an out-of-scope record as not found.
 */
export function tenantScope(req, id, extraWhere = {}) {
  return {
    id,
    tenantId: req.tenantId,
    companyId: req.companyId,
    isDeleted: false,
    ...extraWhere,
  };
}

export async function updateTenantRecord(prisma, model, req, id, data, options = {}) {
  const where = tenantScope(req, id, options.where);
  const result = await prisma[model].updateMany({ where, data });

  if (result.count === 0) {
    const error = new Error(options.notFoundMessage || "Record not found");
    error.statusCode = 404;
    throw error;
  }

  // Do not filter deleted rows here: soft-delete callers still need the row
  // for their audit event and response after a successful scoped mutation.
  return prisma[model].findFirst({
    where: { id, tenantId: req.tenantId, companyId: req.companyId },
    ...(options.include ? { include: options.include } : {}),
    ...(options.select ? { select: options.select } : {}),
  });
}
