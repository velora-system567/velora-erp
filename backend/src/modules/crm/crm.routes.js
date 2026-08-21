import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate } from "../../middleware/validate.js";
import { uuid as _uuid, optionalUuid as _optUuid } from "../../utils/zod-uuid.js";
import { ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPrisma } from "../../config/db.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import { cachedCompute } from "../../utils/single-flight-cache.js";

const router = Router();
router.use(requireAuth, requireTenant);
const uuid = _uuid;
const optionalUuid = _optUuid;

// ─── CRM Dashboard ───────────────────────────────────────────────
router.get("/crm/dashboard", requirePermission(PERMISSIONS.CRM_READ), asyncHandler(async (req, res) => {
  const payload = await cachedCompute(`tenant:${req.tenantId}:company:${req.companyId}:crm:dashboard`, 30, async () => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalLeads, newLeads, qualifiedLeads, wonLeads, lostLeads, totalCustomers, todayFollowUps, pipelineValue, monthlyRevenue, recentLeads] = await Promise.all([
    prisma.lead.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.lead.count({ where: { tenantId, companyId, isDeleted: false, status: "NEW", createdAt: { gte: monthStart } } }),
    prisma.lead.count({ where: { tenantId, companyId, isDeleted: false, status: "QUALIFIED" } }),
    prisma.lead.count({ where: { tenantId, companyId, isDeleted: false, status: "CONVERTED" } }),
    prisma.lead.count({ where: { tenantId, companyId, isDeleted: false, status: "LOST" } }),
    prisma.customer.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.lead.findMany({ where: { tenantId, companyId, isDeleted: false, nextFollowUp: { gte: todayStart, lt: todayEnd } }, orderBy: { nextFollowUp: "asc" }, take: 10 }),
    prisma.lead.aggregate({ where: { tenantId, companyId, isDeleted: false, status: { notIn: ["LOST"] } }, _sum: { value: true } }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true } }),
    prisma.lead.findMany({ where: { tenantId, companyId, isDeleted: false }, orderBy: { updatedAt: "desc" }, take: 10 }),
  ]);

  return {
    kpis: { totalLeads, newLeads, qualifiedLeads, wonLeads, lostLeads, totalCustomers, pipelineValue: pipelineValue._sum.value || 0, monthlyRevenue: monthlyRevenue._sum.totalAmount || 0 },
    todayFollowUps: todayFollowUps.map((l) => ({ id: l.id, name: l.name, contactPerson: l.contactPerson, phone: l.phone, value: l.value, time: l.nextFollowUp, status: l.status })),
    recentLeads: recentLeads.map((l) => ({ id: l.id, name: l.name, contactPerson: l.contactPerson, phone: l.phone, email: l.email, status: l.status, value: l.value, priority: l.priority, city: l.city, source: l.source, updatedAt: l.updatedAt, nextFollowUp: l.nextFollowUp })),
    pipeline: [
      { stage: "New Lead", count: totalLeads, value: 0, color: "slate" },
      { stage: "Qualified", count: qualifiedLeads, value: 0, color: "blue" },
      { stage: "Proposal", count: 0, value: 0, color: "amber" },
      { stage: "Won", count: wonLeads, value: pipelineValue._sum.value || 0, color: "emerald" },
      { stage: "Lost", count: lostLeads, value: 0, color: "rose" },
    ],
  };
  });
  return ok(res, payload, "CRM dashboard loaded");
}));

// ─── CRM Pipeline ────────────────────────────────────────────────
router.get("/crm/pipeline", requirePermission(PERMISSIONS.CRM_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const status = req.query.status || "NEW";
  const leads = await prisma.lead.findMany({
    where: { tenantId, companyId, isDeleted: false, ...(status !== "ALL" ? { status } : {}) },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });
  return ok(res, leads, "Pipeline loaded");
}));

// ─── CRM Customer 360° ──────────────────────────────────────────
router.get("/crm/customers/:id", requirePermission(PERMISSIONS.CRM_READ),
  validate(z.object({ params: z.object({ id: uuid() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { tenantId, companyId } = req;
    const customerId = req.params.id;

    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId, companyId, isDeleted: false } });
    if (!customer) { const e = new Error("Customer not found"); e.statusCode = 404; throw e; }

    const [invoices, quotations, payments, totalPaid] = await Promise.all([
      prisma.businessDocument.findMany({ where: { tenantId, companyId, partyId: customerId, documentType: "INVOICE", isDeleted: false }, orderBy: { documentDate: "desc" }, take: 20 }),
      prisma.businessDocument.findMany({ where: { tenantId, companyId, partyId: customerId, documentType: "QUOTATION", isDeleted: false }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.payment.findMany({ where: { tenantId, companyId, partyId: customerId, partyType: "CUSTOMER", isDeleted: false }, orderBy: { paymentDate: "desc" }, take: 20 }),
      prisma.payment.aggregate({ where: { tenantId, companyId, partyId: customerId, partyType: "CUSTOMER", isDeleted: false }, _sum: { amount: true } }),
    ]);

    const invoiceTotal = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const paidTotal = totalPaid._sum.amount || 0;

    // Build timeline from all activities
    const timeline = [
      ...invoices.map((i) => ({ date: i.createdAt, type: "invoice", title: `Invoice ${i.documentNo}`, amount: i.totalAmount, status: i.status })),
      ...quotations.map((q) => ({ date: q.createdAt, type: "quotation", title: `Quotation ${q.documentNo}`, amount: q.totalAmount, status: q.status })),
      ...payments.map((p) => ({ date: p.createdAt, type: "payment", title: `Payment ${p.paymentNumber}`, amount: p.amount, mode: p.mode })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return ok(res, {
      customer,
      summary: { totalInvoiced: invoiceTotal, totalPaid: paidTotal, outstanding: invoiceTotal - paidTotal, invoiceCount: invoices.length, quotationCount: quotations.length, paymentCount: payments.length, lifetimeValue: paidTotal },
      recentInvoices: invoices.slice(0, 5),
      recentQuotations: quotations.slice(0, 5),
      recentPayments: payments.slice(0, 5),
      timeline: timeline.slice(0, 50),
    }, "Customer 360 loaded");
  }));

// ─── Global Search ───────────────────────────────────────────────
router.get("/crm/search", requirePermission(PERMISSIONS.CRM_READ),
  validate(z.object({ query: z.object({ q: z.string().default("") }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { tenantId, companyId } = req;
    const q = req.validated.query.q;
    if (!q || q.length < 2) return ok(res, { customers: [], leads: [], invoices: [] }, "Search results");

    const [customers, leads, invoices] = await Promise.all([
      prisma.customer.findMany({ where: { tenantId, companyId, isDeleted: false, OR: [{ name: { contains: q, mode: "insensitive" } }, { gstin: { contains: q, mode: "insensitive" } }, { panNumber: { contains: q, mode: "insensitive" } }] }, take: 10 }),
      prisma.lead.findMany({ where: { tenantId, companyId, isDeleted: false, OR: [{ name: { contains: q, mode: "insensitive" } }, { contactPerson: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }, take: 10 }),
      prisma.businessDocument.findMany({ where: { tenantId, companyId, isDeleted: false, documentNo: { contains: q, mode: "insensitive" } }, take: 10 }),
    ]);

    return ok(res, { customers, leads, invoices }, "Search results");
  }));

export default router;
