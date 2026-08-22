/**
 * Velora ERP — Sales Routes
 *
 * All endpoints under /api (mounted in app.js).
 * Tenant + company isolation enforced by middleware.
 * Permissions: sales:view, sales:create, sales:edit, sales:delete, sales:approve, sales:payment
 */
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
import salesService from "./sales.service.js";

const router = Router();
router.use(requireAuth, requireTenant);
const uuid = _uuid;
const optionalUuid = _optUuid;

// ─── Validation Schemas ────────────────────────────────────────────────────────

// ROOT CAUSE FIX: list endpoints previously accepted ANY string as `status`
// (z.string().optional()). The frontend once sent the literal string
// "undefined" (URLSearchParams serializes JS undefined), which flowed into
// Prisma enum filters and threw PrismaClientValidationError → HTTP 500.
// Status is now validated against the actual DocumentStatus/LeadStatus enums,
// so invalid input returns a clean 422 instead of crashing Prisma.
const DOC_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED", "CLOSED"];
const LEAD_STATUSES = ["NEW", "QUALIFIED", "LOST", "CONVERTED"];

const baseListShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  q: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  customerId: optionalUuid().optional(),
  branchId: optionalUuid().optional(),
  createdBy: optionalUuid().optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
};

const leadListQuery = z.object({
  query: z.object({ ...baseListShape, priority: z.string().optional(), source: z.string().optional(), status: z.enum(LEAD_STATUSES).optional() }),
});

const docListQuery = z.object({
  query: z.object({ ...baseListShape, status: z.enum(DOC_STATUSES).optional() }),
});

// Payment model has no status column — never filter on it.
const receiptListQuery = z.object({
  query: z.object(baseListShape),
});

const leadSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    city: z.string().optional(),
    source: z.string().optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    status: z.enum(["NEW", "QUALIFIED", "LOST", "CONVERTED"]).optional(),
    value: z.coerce.number().min(0).optional(),
    notes: z.string().optional(),
    requirement: z.string().optional(),
    nextFollowUp: z.string().datetime().optional().nullable(),
  }),
});

const docHeaderSchema = z.object({
  body: z.object({
    customerId: optionalUuid().optional(),
    documentDate: z.string().datetime().optional(),
    gstTreatment: z.enum(["INTRA_STATE", "INTER_STATE"]).optional(),
    terms: z.string().optional(),
    lines: z.array(z.object({
      itemId: optionalUuid().optional(),
      description: z.string().optional(),
      quantity: z.coerce.number().positive(),
      rate: z.coerce.number().min(0),
      discount: z.coerce.number().min(0).optional(),
      gstRate: z.coerce.number().int().min(0).max(28).optional(),
    })).min(1),
  }),
});

const dnSchema = z.object({
  body: z.object({
    customerId: optionalUuid().optional(),
    salesOrderId: optionalUuid().optional(),
    warehouseId: uuid(),
    documentDate: z.string().datetime().optional(),
    gstTreatment: z.enum(["INTRA_STATE", "INTER_STATE"]).optional(),
    terms: z.string().optional(),
    lines: z.array(z.object({
      itemId: optionalUuid().optional(),
      description: z.string().optional(),
      quantity: z.coerce.number().positive(),
      rate: z.coerce.number().min(0),
      discount: z.coerce.number().min(0).optional(),
      gstRate: z.coerce.number().int().min(0).max(28).optional(),
    })).min(1),
  }),
});

const receiptSchema = z.object({
  body: z.object({
    customerId: uuid(),
    amount: z.coerce.number().positive(),
    mode: z.enum(["CASH", "CHEQUE", "NEFT", "RTGS", "UPI", "CARD"]),
    referenceNo: z.string().optional(),
    bankName: z.string().optional(),
    narration: z.string().optional(),
    paymentDate: z.string().datetime().optional(),
    allocations: z.array(z.object({
      invoiceId: uuid(),
      amount: z.coerce.number().positive(),
    })).optional(),
  }),
});

const statusSchema = z.object({
  body: z.object({
    status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED", "CLOSED"]),
  }),
  params: z.object({ id: uuid() }),
});

// ─── Leads ─────────────────────────────────────────────────────────────────────

router.get("/leads", requirePermission(PERMISSIONS.SALES_READ), validate(leadListQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const { page, limit, status, priority, source, q } = req.validated.query;
  const result = await salesService.listLeads(prisma, { tenantId, companyId, page, limit, status, priority, source, q });
  return ok(res, result, "Leads loaded");
}));

router.post("/leads", requirePermission(PERMISSIONS.SALES_CREATE), validate(leadSchema), asyncHandler(async (req, res) => {
  const lead = await salesService.createLead(null, req, req.validated.body);
  return ok(res, lead, "Lead created");
}));

router.patch("/leads/:id", requirePermission(PERMISSIONS.SALES_UPDATE), validate(leadSchema), asyncHandler(async (req, res) => {
  const lead = await salesService.updateLead(null, req, req.params.id, req.validated.body);
  return ok(res, lead, "Lead updated");
}));

router.delete("/leads/:id", requirePermission(PERMISSIONS.SALES_DELETE), validate(z.object({ params: z.object({ id: uuid() }) })), asyncHandler(async (req, res) => {
  await salesService.deleteLead(null, req, req.params.id);
  return ok(res, { success: true }, "Lead deleted");
}));

// ─── Quotations ────────────────────────────────────────────────────────────────

router.get("/quotations", requirePermission(PERMISSIONS.SALES_READ), validate(docListQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const q = req.validated.query;
  const result = await salesService.listDocuments(prisma, { tenantId, companyId, documentType: "QUOTATION", ...q });
  return ok(res, result, "Quotations loaded");
}));

router.post("/quotations", requirePermission(PERMISSIONS.SALES_CREATE), validate(docHeaderSchema), asyncHandler(async (req, res) => {
  const doc = await salesService.createDocument(null, req, "QUOTATION", req.validated.body);
  return ok(res, doc, "Quotation created");
}));

router.get("/quotations/:id", requirePermission(PERMISSIONS.SALES_READ), validate(z.object({ params: z.object({ id: uuid() }) })), asyncHandler(async (req, res) => {
  const doc = await salesService.getDocument(null, req, req.params.id);
  return ok(res, doc, "Quotation loaded");
}));

router.post("/quotations/:id/convert-to-order", requirePermission(PERMISSIONS.SALES_APPROVE), validate(z.object({ params: z.object({ id: uuid() }) })), asyncHandler(async (req, res) => {
  const order = await salesService.convertQuotationToOrder(null, req, req.params.id);
  return ok(res, order, "Quotation converted to sales order");
}));

router.patch("/quotations/:id/status", requirePermission(PERMISSIONS.SALES_APPROVE), validate(statusSchema), asyncHandler(async (req, res) => {
  const doc = await salesService.updateDocStatus(null, req, req.params.id, req.validated.body.status);
  return ok(res, doc, "Quotation status updated");
}));

// ─── Sales Orders ──────────────────────────────────────────────────────────────

router.get("/sales-orders", requirePermission(PERMISSIONS.SALES_READ), validate(docListQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const q = req.validated.query;
  const result = await salesService.listDocuments(prisma, { tenantId, companyId, documentType: "SALES_ORDER", ...q });
  return ok(res, result, "Sales orders loaded");
}));

router.post("/sales-orders", requirePermission(PERMISSIONS.SALES_CREATE), validate(docHeaderSchema), asyncHandler(async (req, res) => {
  const doc = await salesService.createDocument(null, req, "SALES_ORDER", req.validated.body);
  return ok(res, doc, "Sales order created");
}));

router.get("/sales-orders/:id", requirePermission(PERMISSIONS.SALES_READ), validate(z.object({ params: z.object({ id: uuid() }) })), asyncHandler(async (req, res) => {
  const doc = await salesService.getDocument(null, req, req.params.id);
  return ok(res, doc, "Sales order loaded");
}));

router.patch("/sales-orders/:id/status", requirePermission(PERMISSIONS.SALES_APPROVE), validate(statusSchema), asyncHandler(async (req, res) => {
  const doc = await salesService.updateDocStatus(null, req, req.params.id, req.validated.body.status);
  return ok(res, doc, "Sales order status updated");
}));

// ─── Delivery Notes ────────────────────────────────────────────────────────────

router.get("/delivery-notes", requirePermission(PERMISSIONS.SALES_READ), validate(docListQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const q = req.validated.query;
  const result = await salesService.listDocuments(prisma, { tenantId, companyId, documentType: "DELIVERY_NOTE", ...q });
  return ok(res, result, "Delivery notes loaded");
}));

router.post("/delivery-notes", requirePermission(PERMISSIONS.SALES_CREATE), validate(dnSchema), asyncHandler(async (req, res) => {
  const doc = await salesService.createDeliveryNote(null, req, req.validated.body);
  return ok(res, doc, "Delivery note created");
}));

router.get("/delivery-notes/:id", requirePermission(PERMISSIONS.SALES_READ), validate(z.object({ params: z.object({ id: uuid() }) })), asyncHandler(async (req, res) => {
  const doc = await salesService.getDocument(null, req, req.params.id);
  return ok(res, doc, "Delivery note loaded");
}));

// ─── Invoices ──────────────────────────────────────────────────────────────────

router.get("/invoices", requirePermission(PERMISSIONS.SALES_READ), validate(docListQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const q = req.validated.query;
  const result = await salesService.listDocuments(prisma, { tenantId, companyId, documentType: "INVOICE", ...q });
  return ok(res, result, "Invoices loaded");
}));

router.post("/invoices", requirePermission(PERMISSIONS.SALES_CREATE), validate(docHeaderSchema), asyncHandler(async (req, res) => {
  const doc = await salesService.createInvoice(null, req, req.validated.body);
  return ok(res, doc, "Invoice created");
}));

router.get("/invoices/:id", requirePermission(PERMISSIONS.SALES_READ), validate(z.object({ params: z.object({ id: uuid() }) })), asyncHandler(async (req, res) => {
  const doc = await salesService.getDocument(null, req, req.params.id);
  return ok(res, doc, "Invoice loaded");
}));

// ─── Payment Receipts ──────────────────────────────────────────────────────────

router.get("/payment-receipts", requirePermission(PERMISSIONS.SALES_READ), validate(receiptListQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const q = req.validated.query;
  const where = { tenantId, companyId, paymentType: "RECEIPT", isDeleted: false };
  if (q.customerId) where.partyId = q.customerId;
  if (q.dateFrom || q.dateTo) {
    where.paymentDate = {};
    if (q.dateFrom) where.paymentDate.gte = new Date(`${q.dateFrom}T00:00:00.000Z`);
    if (q.dateTo) where.paymentDate.lte = new Date(`${q.dateTo}T23:59:59.999Z`);
  }
  if (q.amountMin !== undefined || q.amountMax !== undefined) {
    where.amount = {};
    if (q.amountMin !== undefined) where.amount.gte = Math.round(q.amountMin * 100);
    if (q.amountMax !== undefined) where.amount.lte = Math.round(q.amountMax * 100);
  }

  const orderBy = {};
  if (q.sortBy) orderBy[q.sortBy] = q.sortOrder === "desc" ? "desc" : "asc";
  else orderBy.paymentDate = "desc";

  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      orderBy,
      include: { allocations: { include: { document: { select: { documentNo: true, documentType: true, totalAmount: true } } } } },
    }),
  ]);

  return ok(res, { rows, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) || 1 } }, "Receipts loaded");
}));

router.post("/payment-receipts", requirePermission(PERMISSIONS.SALES_PAYMENT), validate(receiptSchema), asyncHandler(async (req, res) => {
  const payment = await salesService.recordPaymentReceipt(null, req, req.validated.body);
  return ok(res, payment, "Payment receipt recorded");
}));

// ─── Dashboards & Analytics ────────────────────────────────────────────────────

router.get("/sales/dashboard", requirePermission(PERMISSIONS.SALES_READ), asyncHandler(async (req, res) => {
  const payload = await cachedCompute(`tenant:${req.tenantId}:company:${req.companyId}:sales:dashboard`, 30, async () => {
    return salesService.getSalesDashboard(req);
  });
  return ok(res, payload, "Sales dashboard loaded");
}));

router.get("/sales/owner-dashboard", requirePermission(PERMISSIONS.SALES_READ), asyncHandler(async (req, res) => {
  const payload = await cachedCompute(`tenant:${req.tenantId}:company:${req.companyId}:sales:owner-dashboard`, 30, async () => {
    return salesService.getOwnerDashboard(req);
  });
  return ok(res, payload, "Owner dashboard loaded");
}));

router.get("/sales/analytics", requirePermission(PERMISSIONS.SALES_READ), asyncHandler(async (req, res) => {
  const payload = await cachedCompute(`tenant:${req.tenantId}:company:${req.companyId}:sales:analytics`, 300, async () => {
    return salesService.getSalesAnalytics(req);
  });
  return ok(res, payload, "Sales analytics loaded");
}));

// ─── Customer Outstanding & Ledger ─────────────────────────────────────────────

router.get("/customers/:id/outstanding", requirePermission(PERMISSIONS.SALES_READ), validate(z.object({ params: z.object({ id: uuid() }) })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const customerId = req.params.id;

  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId, companyId, isDeleted: false } });
  if (!customer) { const e = new Error("Customer not found"); e.statusCode = 404; throw e; }

  const [invoices, payments] = await Promise.all([
    prisma.businessDocument.findMany({ where: { tenantId, companyId, partyId: customerId, documentType: "INVOICE", isDeleted: false, status: { not: "CANCELLED" } }, select: { id: true, documentNo: true, documentDate: true, totalAmount: true, status: true } }),
    prisma.payment.findMany({ where: { tenantId, companyId, partyId: customerId, partyType: "CUSTOMER", isDeleted: false, paymentType: "RECEIPT" }, select: { id: true, paymentNumber: true, paymentDate: true, amount: true, allocations: { select: { documentId: true, amount: true } } } }),
  ]);

  let totalInvoiced = 0, totalPaid = 0;
  const invoiceOuts = [];
  for (const inv of invoices) {
    const paid = payments.filter((p) => p.allocations.some((a) => a.documentId === inv.id)).reduce((s, p) => s + p.allocations.filter((a) => a.documentId === inv.id).reduce((s2, a) => s2 + a.amount, 0), 0);
    const outstanding = inv.totalAmount - paid;
    if (outstanding > 0) {
      totalInvoiced += inv.totalAmount;
      totalPaid += paid;
      invoiceOuts.push({ ...inv, outstanding, paid });
    }
  }

  return ok(res, {
    customer,
    summary: { totalInvoiced, totalPaid, outstanding: totalInvoiced - totalPaid, invoiceCount: invoices.length },
    invoices: invoiceOuts,
  }, "Customer outstanding loaded");
}));

router.get("/customers/:id/ledger", requirePermission(PERMISSIONS.SALES_READ), validate(z.object({ params: z.object({ id: uuid() }) })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const customerId = req.params.id;

  const [invoices, payments, receipts] = await Promise.all([
    prisma.businessDocument.findMany({ where: { tenantId, companyId, partyId: customerId, isDeleted: false, documentType: { in: ["INVOICE", "SALES_ORDER", "QUOTATION", "DELIVERY_NOTE"] } }, orderBy: { documentDate: "desc" }, select: { id: true, documentType: true, documentNo: true, documentDate: true, totalAmount: true, status: true } }),
    prisma.payment.findMany({ where: { tenantId, companyId, partyId: customerId, partyType: "CUSTOMER", isDeleted: false }, orderBy: { paymentDate: "desc" }, include: { allocations: { include: { document: { select: { documentNo: true, documentType: true } } } } } }),
  ]);

  const timeline = [
    ...invoices.map((i) => ({ date: i.documentDate, type: i.documentType, title: `${i.documentType} ${i.documentNo}`, amount: i.totalAmount, status: i.status })),
    ...payments.map((p) => ({ date: p.paymentDate, type: "RECEIPT", title: `Receipt ${p.paymentNumber}`, amount: p.amount, mode: p.mode })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return ok(res, { customerId, timeline }, "Customer ledger loaded");
}));

// ─── Item Search for Pickers ───────────────────────────────────────────────────

router.get("/items/search", requirePermission(PERMISSIONS.SALES_READ), validate(z.object({ query: z.object({ q: z.string().default(""), limit: z.coerce.number().int().min(1).max(50).default(20) }) })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const q = req.validated.query.q;
  if (!q || q.length < 2) return ok(res, { items: [] }, "Item search results");

  const items = await prisma.item.findMany({
    where: { tenantId, companyId, isDeleted: false, isActive: true, OR: [{ itemCode: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
    take: req.validated.query.limit,
    select: { id: true, itemCode: true, name: true, sellingPrice: true, gstRate: true, unitOfMeasure: { select: { symbol: true } } },
  });

  return ok(res, { items }, "Item search results");
}));

export default router;