import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import {
  createPurchaseRequest, approvePurchaseRequest, listPurchaseRequests,
  createRfq, listRfqs,
  createPurchaseOrder, listPurchaseDocs,
  createGrn, approveGrn, listGrns,
  createPurchaseInvoice,
  recordVendorPayment, getPurchaseOutstanding,
  getPurchaseDashboard, getPurchaseAnalytics, getPurchaseReport,
} from "./purchase.service.js";
import { updateTenantRecord } from "../../utils/tenant-record.js";

const router = Router();
router.use(requireAuth, requireTenant);

const lineSchema = z.object({
  itemId: z.string().uuid().optional(),
  description: z.string().optional().or(z.literal("")),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  gstRate: z.coerce.number().int().min(0).max(28).default(18),
});

const listQuery = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.string().optional(),
  }),
});

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

// ─── PURCHASE REQUESTS ────────────────────────────────────────────────────────
router.get("/purchase-requests", requirePermission(PERMISSIONS.PURCHASE_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const { rows, meta } = await listPurchaseRequests(req, req.validated.query);
  return ok(res, rows, "Purchase requests loaded", meta);
}));

router.post("/purchase-requests", requirePermission(PERMISSIONS.PURCHASE_CREATE),
  validate(z.object({
    body: z.object({
      requiredBy: z.string().optional(),
      notes: z.string().optional().or(z.literal("")),
      lines: z.array(z.object({
        itemId: z.string().uuid(),
        description: z.string().optional().or(z.literal("")),
        quantity: z.coerce.number().positive(),
        estimatedRate: z.coerce.number().min(0).default(0),
      })).min(1),
    }),
  })),
  asyncHandler(async (req, res) => {
    const pr = await createPurchaseRequest(req, req.validated.body);
    return created(res, pr, "Purchase request created");
  }));

router.post("/purchase-requests/:id/approve", requirePermission(PERMISSIONS.PURCHASE_APPROVE), validate(idParam), asyncHandler(async (req, res) => {
  const pr = await approvePurchaseRequest(req, req.params.id);
  return ok(res, pr, "Purchase request approved");
}));

// ─── RFQs ────────────────────────────────────────────────────────────────────
router.get("/rfqs", requirePermission(PERMISSIONS.PURCHASE_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const { rows, meta } = await listRfqs(req, req.validated.query);
  return ok(res, rows, "RFQs loaded", meta);
}));

router.post("/rfqs", requirePermission(PERMISSIONS.PURCHASE_CREATE),
  validate(z.object({
    body: z.object({
      vendorId: z.string().uuid(),
      validUntil: z.string().optional(),
      notes: z.string().optional().or(z.literal("")),
      lines: z.array(z.object({
        itemId: z.string().uuid(),
        description: z.string().optional().or(z.literal("")),
        quantity: z.coerce.number().positive(),
        quotedRate: z.coerce.number().min(0).default(0),
        gstRate: z.coerce.number().int().min(0).max(28).default(18),
      })).min(1),
    }),
  })),
  asyncHandler(async (req, res) => {
    const rfq = await createRfq(req, req.validated.body);
    return created(res, rfq, "RFQ created");
  }));

// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────
router.get("/purchase-orders", requirePermission(PERMISSIONS.PURCHASE_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const { rows, meta } = await listPurchaseDocs(req, "PURCHASE_ORDER", req.validated.query);
  return ok(res, rows, "Purchase orders loaded", meta);
}));

router.post("/purchase-orders", requirePermission(PERMISSIONS.PURCHASE_CREATE),
  validate(z.object({
    body: z.object({
      vendorId: z.string().uuid().optional(),
      documentDate: z.string().optional(),
      gstTreatment: z.enum(["INTRA_STATE", "INTER_STATE"]).default("INTRA_STATE"),
      terms: z.string().optional().or(z.literal("")),
      lines: z.array(lineSchema).min(1),
    }),
  })),
  asyncHandler(async (req, res) => {
    const po = await createPurchaseOrder(req, req.validated.body);
    return created(res, po, "Purchase order created");
  }));

router.get("/purchase-orders/:id", requirePermission(PERMISSIONS.PURCHASE_READ), validate(idParam), asyncHandler(async (req, res) => {
  const prisma = (await import("../../config/db.js")).getPrisma();
  const doc = await prisma.businessDocument.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    include: { lines: { where: { isDeleted: false } } },
  });
  if (!doc) { const e = new Error("Purchase order not found"); e.statusCode = 404; throw e; }
  return ok(res, doc, "Purchase order loaded");
}));

router.patch("/purchase-orders/:id/approve", requirePermission(PERMISSIONS.PURCHASE_APPROVE), validate(idParam), asyncHandler(async (req, res) => {
  const prisma = (await import("../../config/db.js")).getPrisma();
  const { writeAudit } = await import("../../utils/audit.js");
  const doc = await updateTenantRecord(prisma, "businessDocument", req, req.params.id,
    { status: "APPROVED", updatedBy: req.user.sub },
    { where: { documentType: "PURCHASE_ORDER" }, notFoundMessage: "Purchase order not found" });
  await writeAudit(req, { tableName: "business_documents", recordId: doc.id, action: "PURCHASE_ORDER_APPROVED", newValue: doc });
  return ok(res, doc, "Purchase order approved");
}));

// ─── GRN ─────────────────────────────────────────────────────────────────────
router.get("/grns", requirePermission(PERMISSIONS.PURCHASE_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const { rows, meta } = await listGrns(req, req.validated.query);
  return ok(res, rows, "GRNs loaded", meta);
}));

router.post("/grns", requirePermission(PERMISSIONS.PURCHASE_CREATE),
  validate(z.object({
    body: z.object({
      vendorId: z.string().uuid(),
      warehouseId: z.string().uuid(),
      poId: z.string().uuid().optional(),
      receiptDate: z.string().optional(),
      notes: z.string().optional().or(z.literal("")),
      lines: z.array(z.object({
        itemId: z.string().uuid(),
        orderedQty: z.coerce.number().positive(),
        receivedQty: z.coerce.number().positive(),
        acceptedQty: z.coerce.number().positive(),
        rate: z.coerce.number().min(0),
        gstRate: z.coerce.number().int().min(0).max(28).default(18),
        batchNumber: z.string().optional().or(z.literal("")),
        expiryDate: z.string().optional().or(z.literal("")),
      })).min(1),
    }),
  })),
  asyncHandler(async (req, res) => {
    const grn = await createGrn(req, req.validated.body);
    return created(res, grn, "GRN created");
  }));

router.get("/grns/:id", requirePermission(PERMISSIONS.PURCHASE_READ), validate(idParam), asyncHandler(async (req, res) => {
  const prisma = (await import("../../config/db.js")).getPrisma();
  const grn = await prisma.goodsReceiptNote.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    include: { lines: true },
  });
  if (!grn) { const e = new Error("GRN not found"); e.statusCode = 404; throw e; }
  return ok(res, grn, "GRN loaded");
}));

router.post("/grns/:id/approve", requirePermission(PERMISSIONS.PURCHASE_APPROVE), validate(idParam), asyncHandler(async (req, res) => {
  const grn = await approveGrn(req, req.params.id);
  return ok(res, grn, "GRN approved and stock credited");
}));

// ─── PURCHASE INVOICES ───────────────────────────────────────────────────────
router.get("/purchase-invoices", requirePermission(PERMISSIONS.PURCHASE_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const { rows, meta } = await listPurchaseDocs(req, "PURCHASE_INVOICE", req.validated.query);
  return ok(res, rows, "Purchase invoices loaded", meta);
}));

router.post("/purchase-invoices", requirePermission(PERMISSIONS.PURCHASE_CREATE),
  validate(z.object({
    body: z.object({
      vendorId: z.string().uuid().optional(),
      documentDate: z.string().optional(),
      gstTreatment: z.enum(["INTRA_STATE", "INTER_STATE"]).default("INTRA_STATE"),
      terms: z.string().optional().or(z.literal("")),
      lines: z.array(lineSchema).min(1),
    }),
  })),
  asyncHandler(async (req, res) => {
    const inv = await createPurchaseInvoice(req, req.validated.body);
    return created(res, inv, "Purchase invoice created");
  }));

// ─── VENDOR PAYMENTS ─────────────────────────────────────────────────────────
router.get("/vendor-payments", requirePermission(PERMISSIONS.PURCHASE_READ), asyncHandler(async (req, res) => {
  const prisma = (await import("../../config/db.js")).getPrisma();
  const rows = await prisma.payment.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, paymentType: "PAYMENT", isDeleted: false },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return ok(res, rows, "Vendor payments loaded");
}));

router.post("/vendor-payments", requirePermission(PERMISSIONS.PURCHASE_PAYMENT),
  validate(z.object({
    body: z.object({
      vendorId: z.string().uuid().optional(),
      amount: z.coerce.number().positive(),
      mode: z.enum(["CASH", "CHEQUE", "NEFT", "RTGS", "UPI", "CARD"]),
      referenceNo: z.string().optional().or(z.literal("")),
      bankName: z.string().optional().or(z.literal("")),
      narration: z.string().optional().or(z.literal("")),
      paymentDate: z.string().optional(),
      allocations: z.array(z.object({ invoiceId: z.string().uuid(), amount: z.coerce.number().positive() })).optional(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const payment = await recordVendorPayment(req, req.validated.body);
    return created(res, payment, "Vendor payment recorded");
  }));

// ─── PURCHASE DASHBOARD ────────────────────────────────────
router.get("/purchase/dashboard", requirePermission(PERMISSIONS.PURCHASE_READ), asyncHandler(async (req, res) => {
  const data = await getPurchaseDashboard(req);
  return ok(res, data, "Purchase dashboard loaded");
}));

router.get("/purchase/analytics", requirePermission(PERMISSIONS.PURCHASE_READ), asyncHandler(async (req, res) => {
  const data = await getPurchaseAnalytics(req);
  return ok(res, data, "Purchase analytics loaded");
}));

router.get("/purchase/report", requirePermission(PERMISSIONS.PURCHASE_READ),
  validate(z.object({ query: z.object({ fromDate: z.string().optional(), toDate: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const data = await getPurchaseReport(req, req.validated.query);
    return ok(res, data, "Purchase report loaded");
  }));

// ─── REPORTS ─────────────────────────────────────────────────────────────────
router.get("/purchase/outstanding-report", requirePermission(PERMISSIONS.PURCHASE_READ), asyncHandler(async (req, res) => {
  const rows = await getPurchaseOutstanding(req);
  return ok(res, rows, "Purchase outstanding report");
}));

router.get("/vendors/:id/ledger", requirePermission(PERMISSIONS.PURCHASE_READ), asyncHandler(async (req, res) => {
  const prisma = (await import("../../config/db.js")).getPrisma();
  const docs = await prisma.businessDocument.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, partyId: req.params.id, isDeleted: false },
    orderBy: { documentDate: "asc" },
  });
  return ok(res, docs, "Vendor ledger");
}));

export default router;
