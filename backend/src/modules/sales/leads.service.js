import { getPrisma } from "../../config/db.js";
import { writeAudit } from "../../utils/audit.js";
import { rupeesToPaise } from "../../utils/money.js";
import { updateTenantRecord } from "../../utils/tenant-record.js";

function cleanLead(input) {
  return {
    name: input.name,
    contactPerson: input.contactPerson || null,
    phone: input.phone || null,
    email: input.email || null,
    city: input.city || null,
    source: input.source || null,
    priority: input.priority || "MEDIUM",
    status: input.status || "NEW",
    value: rupeesToPaise(input.value || 0),
    notes: input.notes || null,
    requirement: input.requirement || null,
    nextFollowUp: input.nextFollowUp ? new Date(input.nextFollowUp) : null,
  };
}

export async function listLeads(req, { page = 1, limit = 100, status, q, priority, source, sortBy = "createdAt", sortOrder = "desc" } = {}) {
  const prisma = getPrisma();
  const where = {
    tenantId: req.tenantId,
    companyId: req.companyId,
    isDeleted: false,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(source ? { source } : {}),
  };

  if (q) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { contactPerson: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { city: { contains: term, mode: "insensitive" } },
      { requirement: { contains: term, mode: "insensitive" } },
      { notes: { contains: term, mode: "insensitive" } },
    ];
  }

  const sortFieldMap = {
    createdAt: "createdAt",
    name: "name",
    value: "value",
    nextFollowUp: "nextFollowUp",
    priority: "priority",
    status: "status",
  };
  const field = sortFieldMap[sortBy] || "createdAt";
  const order = sortOrder === "asc" ? "asc" : "desc";

  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      skip,
      take: Math.min(limit, 500),
      orderBy: [{ nextFollowUp: "asc" }, { [field]: order }],
    }),
  ]);
  return { rows, meta: { page, limit: Math.min(limit, 500), total } };
}

export async function createLead(req, input) {
  const prisma = getPrisma();
  const lead = await prisma.lead.create({
    data: {
      ...cleanLead(input),
      tenantId: req.tenantId,
      companyId: req.companyId,
      branchId: req.branchId || null,
      createdBy: req.user.sub,
      updatedBy: req.user.sub,
    },
  });
  await writeAudit(req, { tableName: "leads", recordId: lead.id, action: "LEAD_CREATED", newValue: lead });
  return lead;
}

export async function updateLead(req, id, input) {
  const prisma = getPrisma();
  const old = await prisma.lead.findFirst({ where: { id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
  if (!old) { const e = new Error("Lead not found"); e.statusCode = 404; throw e; }
  const merged = cleanLead({ ...old, ...input, value: input.value !== undefined ? rupeesToPaise(input.value) : old.value });
  const lead = await updateTenantRecord(prisma, "lead", req, id, { ...merged, updatedBy: req.user.sub }, { notFoundMessage: "Lead not found" });
  await writeAudit(req, { tableName: "leads", recordId: lead.id, action: "LEAD_UPDATED", oldValue: old, newValue: lead });
  return lead;
}

export async function deleteLead(req, id) {
  const prisma = getPrisma();
  const lead = await updateTenantRecord(prisma, "lead", req, id, { isDeleted: true, updatedBy: req.user.sub }, { notFoundMessage: "Lead not found" });
  await writeAudit(req, { tableName: "leads", recordId: lead.id, action: "LEAD_DELETED", newValue: lead });
  return lead;
}
