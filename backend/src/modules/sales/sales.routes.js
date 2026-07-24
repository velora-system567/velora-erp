import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import {
  createQuotation,
  convertQuotationToOrder,
  createDeliveryNote,
  createInvoice,
  recordPaymentReceipt,
  listSalesDocs,
  getSalesDoc,
  updateDocStatus,
  getOutstandingReport,
  getSalesDashboard,
  getSalesAnalytics,
  getOwnerDashboard,
} from "./sales.service.js";
import {
  createLead,
  listLeads,
  updateLead,
  deleteLead,
} from "./leads.service.js";

const router = Router();
router.use(requireAuth, requireTenant);

// ─── Line schema ──────────────────────────────────────────────────────────────
const lineSchema = z.object({
  itemId: z.string().uuid().optional(),
  description: z.string().optional().or(z.literal("")),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  gstRate: z.coerce.number().int().min(0).max(28).default(18),
});

const docHeaderSchema = z.object({
  customerId: z.string().uuid().optional(),
  documentDate: z.string().optional(),
  gstTreatment: z.enum(["INTRA_STATE", "INTER_STATE"]).default("INTRA_STATE"),
  terms: z.string().optional().or(z.literal("")),
  lines: z.array(lineSchema).min(1),
});

const listQuery = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).default(20).transform(v => Math.min(v, 500)),
    status: z.string().optional(),
    q: z.string().optional(),
  }),
});

// ─── LEADS ────────────────────────────────────────────────────────────────────
const leadSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    contactPerson: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    email: z.string().email().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    source: z.string().optional().or(z.literal("")),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
    status: z.enum(["NEW", "QUALIFIED", "LOST", "CONVERTED"]).default("NEW"),
    value: z.coerce.number().min(0).default(0),
    notes: z.string().optional().or(z.literal("")),
    requirement: z.string().optional().or(z.literal("")),
    nextFollowUp: z.string().optional().or(z.literal("")),
  }),
});

router.get("/leads", requirePermission(PERMISSIONS.SALES_READ), asyncHandler(async (req, res) => {
  const rows = await listLeads(req);
  return ok(res, rows, "Leads loaded");
}));

router.post("/leads", requirePermission(PERMISSIONS.SALES_CREATE), validate(leadSchema), asyncHandler(async (req, res) => {
  const lead = await createLead(req, req.validated.body);
  return created(res, lead, "Lead created");
}));

router.patch("/leads/:id", requirePermission(PERMISSIONS.SALES_UPDATE),
  validate(z.object({ params: z.object({ id: z.string().uuid() }), body: leadSchema.shape.body.partial() })),
  asyncHandler(async (req, res) => {
    const lead = await updateLead(req, req.params.id, req.validated.body);
    return ok(res, lead, "Lead updated");
  }));

router.delete("/leads/:id", requirePermission(PERMISSIONS.SALES_DELETE),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const lead = await deleteLead(req, req.params.id);
    return ok(res, lead, "Lead deleted");
  }));

// ─── QUOTATIONS ──────────────────────────────────────────────────────────────
router.get("/quotations", requirePermission(PERMISSIONS.SALES_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const { rows, meta } = await listSalesDocs(req, "QUOTATION", req.validated.query);
  return ok(res, rows, "Quotations loaded", meta);
}));

router.post("/quotations", requirePermission(PERMISSIONS.SALES_CREATE),
  validate(z.object({ body: docHeaderSchema })),
  asyncHandler(async (req, res) => {
    const doc = await createQuotation(req, req.validated.body);
    return created(res, doc, "Quotation created");
  }));

router.get("/quotations/:id", requirePermission(PERMISSIONS.SALES_READ),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const doc = await getSalesDoc(req, req.params.id);
    return ok(res, doc, "Quotation loaded");
  }));

router.post("/quotations/:id/convert-to-order", requirePermission(PERMISSIONS.SALES_APPROVE),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const so = await convertQuotationToOrder(req, req.params.id);
    return created(res, so, "Sales Order created from Quotation");
  }));

router.patch("/quotations/:id/status", requirePermission(PERMISSIONS.SALES_APPROVE),
  validate(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"]) }) })),
  asyncHandler(async (req, res) => {
    const doc = await updateDocStatus(req, req.params.id, req.validated.body.status);
    return ok(res, doc, "Status updated");
  }));

// ─── SALES ORDERS ────────────────────────────────────────────────────────────
router.get("/sales-orders", requirePermission(PERMISSIONS.SALES_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const { rows, meta } = await listSalesDocs(req, "SALES_ORDER", req.validated.query);
  return ok(res, rows, "Sales orders loaded", meta);
}));

router.post("/sales-orders", requirePermission(PERMISSIONS.SALES_CREATE),
  validate(z.object({ body: docHeaderSchema })),
  asyncHandler(async (req, res) => {
    // Direct SO creation (without quotation conversion)
    const { createQuotation: _q, ...svc } = await import("./sales.service.js");
    const input = { ...req.validated.body };
    const prisma = (await import("../../config/db.js")).getPrisma();
    const { computeDocumentTotals, rupeesToPaise } = await import("../../utils/money.js");
    const { nextDocNumber } = await import("../../utils/doc-number.js");
    const { writeAudit } = await import("../../utils/audit.js");
    const { tenantId, companyId, branchId } = req;
    const userId = req.user.sub;
    const lines = input.lines.map((l) => ({ ...l, ratePaise: rupeesToPaise(l.rate), discountPaise: rupeesToPaise(l.discount || 0) }));
    const totals = computeDocumentTotals(lines, input.gstTreatment || "INTRA_STATE");
    const doc = await prisma.$transaction(async (tx) => {
      const documentNo = await nextDocNumber({ tx, tenantId, companyId, docType: "SO" });
      const so = await tx.businessDocument.create({
        data: { tenantId, companyId, branchId: branchId || null, documentType: "SALES_ORDER", documentNo, partyId: input.customerId || null, status: "DRAFT", documentDate: input.documentDate ? new Date(input.documentDate) : new Date(), ...totals, terms: input.terms || null, createdBy: userId, updatedBy: userId },
      });
      await tx.businessDocumentLine.createMany({
        data: lines.map((l) => ({ tenantId, companyId, branchId: branchId || null, documentId: so.id, itemId: l.itemId || null, description: l.description || null, quantity: l.quantity, rate: l.ratePaise, discount: l.discountPaise || 0, gstRate: l.gstRate, lineTotal: Math.round(l.quantity * l.ratePaise - (l.discountPaise || 0)), createdBy: userId, updatedBy: userId })),
      });
      await writeAudit(req, { tx, tableName: "business_documents", recordId: so.id, action: "SALES_ORDER_CREATED", newValue: so });
      return tx.businessDocument.findUnique({ where: { id: so.id }, include: { lines: true } });
    });
    return created(res, doc, "Sales order created");
  }));

router.get("/sales-orders/:id", requirePermission(PERMISSIONS.SALES_READ),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const doc = await getSalesDoc(req, req.params.id);
    return ok(res, doc, "Sales order loaded");
  }));

router.patch("/sales-orders/:id/status", requirePermission(PERMISSIONS.SALES_APPROVE),
  validate(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ status: z.enum(["SUBMITTED", "APPROVED", "CANCELLED", "CLOSED"]) }) })),
  asyncHandler(async (req, res) => {
    const doc = await updateDocStatus(req, req.params.id, req.validated.body.status);
    return ok(res, doc, "Status updated");
  }));

// ─── DELIVERY NOTES ──────────────────────────────────────────────────────────
const dnSchema = z.object({
  body: z.object({
    customerId: z.string().uuid().optional(),
    salesOrderId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    documentDate: z.string().optional(),
    lines: z.array(z.object({
      itemId: z.string().uuid().optional(),
      description: z.string().optional().or(z.literal("")),
      quantity: z.coerce.number().positive(),
      rate: z.coerce.number().min(0).default(0),
    })).min(1),
  }),
});

router.get("/delivery-notes", requirePermission(PERMISSIONS.SALES_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const { rows, meta } = await listSalesDocs(req, "DELIVERY_NOTE", req.validated.query);
  return ok(res, rows, "Delivery notes loaded", meta);
}));

router.post("/delivery-notes", requirePermission(PERMISSIONS.SALES_CREATE),
  validate(dnSchema),
  asyncHandler(async (req, res) => {
    const doc = await createDeliveryNote(req, req.validated.body);
    return created(res, doc, "Delivery note created");
  }));

router.get("/delivery-notes/:id", requirePermission(PERMISSIONS.SALES_READ),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const doc = await getSalesDoc(req, req.params.id);
    return ok(res, doc, "Delivery note loaded");
  }));

// ─── INVOICES ─────────────────────────────────────────────────────────────────
router.get("/invoices", requirePermission(PERMISSIONS.SALES_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const { rows, meta } = await listSalesDocs(req, "INVOICE", req.validated.query);
  return ok(res, rows, "Invoices loaded", meta);
}));

router.post("/invoices", requirePermission(PERMISSIONS.SALES_CREATE),
  validate(z.object({ body: docHeaderSchema })),
  asyncHandler(async (req, res) => {
    const doc = await createInvoice(req, req.validated.body);
    return created(res, doc, "Invoice created");
  }));

router.get("/invoices/:id", requirePermission(PERMISSIONS.SALES_READ),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const doc = await getSalesDoc(req, req.params.id);
    return ok(res, doc, "Invoice loaded");
  }));

// ─── PAYMENT RECEIPTS ─────────────────────────────────────────────────────────
const receiptSchema = z.object({
  body: z.object({
    customerId: z.string().uuid().optional(),
    amount: z.coerce.number().positive(),
    mode: z.enum(["CASH", "CHEQUE", "NEFT", "RTGS", "UPI", "CARD"]),
    referenceNo: z.string().optional().or(z.literal("")),
    bankName: z.string().optional().or(z.literal("")),
    narration: z.string().optional().or(z.literal("")),
    paymentDate: z.string().optional(),
    allocations: z.array(z.object({ invoiceId: z.string().uuid(), amount: z.coerce.number().positive() })).optional(),
  }),
});

router.get("/payment-receipts", requirePermission(PERMISSIONS.SALES_READ), asyncHandler(async (req, res) => {
  const prisma = (await import("../../config/db.js")).getPrisma();
  const rows = await prisma.payment.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, paymentType: "RECEIPT", isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(res, rows, "Receipts loaded");
}));

router.post("/payment-receipts", requirePermission(PERMISSIONS.SALES_PAYMENT),
  validate(receiptSchema),
  asyncHandler(async (req, res) => {
    const payment = await recordPaymentReceipt(req, req.validated.body);
    return created(res, payment, "Payment receipt recorded");
  }));

// ─── SALES DASHBOARD ─────────────────────────────────────────────────────────
router.get("/sales/dashboard", requirePermission(PERMISSIONS.SALES_READ), asyncHandler(async (req, res) => {
  const data = await getSalesDashboard(req);
  return ok(res, data, "Sales dashboard loaded");
}));

router.get("/sales/analytics", requirePermission(PERMISSIONS.SALES_READ), asyncHandler(async (req, res) => {
  const data = await getSalesAnalytics(req);
  return ok(res, data, "Sales analytics loaded");
}));

router.get("/sales/owner-dashboard", requirePermission(PERMISSIONS.SALES_READ), asyncHandler(async (req, res) => {
  const data = await getOwnerDashboard(req);
  return ok(res, data, "Owner dashboard loaded");
}));

// ─── REPORTS ─────────────────────────────────────────────────────────────────
router.get("/sales/outstanding-report", requirePermission(PERMISSIONS.SALES_READ), asyncHandler(async (req, res) => {
  const rows = await getOutstandingReport(req);
  return ok(res, rows, "Outstanding report");
}));

router.get("/customers/:id/outstanding", requirePermission(PERMISSIONS.SALES_READ),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const rows = await getOutstandingReport(req);
    const filtered = rows.filter((r) => r.partyId === req.params.id);
    const total = filtered.reduce((s, r) => s + r.outstandingAmount, 0);
    return ok(res, { customerId: req.params.id, outstandingPaise: total, rows: filtered }, "Customer outstanding");
  }));

router.get("/customers/:id/ledger", requirePermission(PERMISSIONS.SALES_READ), asyncHandler(async (req, res) => {
  const prisma = (await import("../../config/db.js")).getPrisma();
  const docs = await prisma.businessDocument.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, partyId: req.params.id, isDeleted: false },
    orderBy: { documentDate: "asc" },
  });
  return ok(res, docs, "Customer ledger");
}));

// ─── Item Search ──────────────────────────────────────────────────────────────
router.get("/items/search", requirePermission(PERMISSIONS.SALES_READ),
  validate(z.object({ query: z.object({ q: z.string().default("") }) })),
  asyncHandler(async (req, res) => {
    const prisma = (await import("../../config/db.js")).getPrisma();
    const rows = await prisma.item.findMany({
      where: {
        tenantId: req.tenantId, companyId: req.companyId, isDeleted: false,
        OR: [
          { name: { contains: req.validated.query.q, mode: "insensitive" } },
          { itemCode: { contains: req.validated.query.q, mode: "insensitive" } },
        ],
      },
      take: 20,
    });
    return ok(res, rows, "Items found");
  }));

export default router;
