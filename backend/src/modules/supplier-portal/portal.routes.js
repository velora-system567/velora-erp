import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPrisma } from "../../config/db.js";
import { PERMISSIONS } from "../../utils/permissions.js";

const router = Router();
router.use(requireAuth, requireTenant);

// ─── Supplier Dashboard ──────────────────────────────────────────
router.get("/supplier-portal/dashboard", requirePermission(PERMISSIONS.PURCHASE_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const { vendorId } = req.query;

  const vWhere = { tenantId, companyId, documentType: "PURCHASE_ORDER", isDeleted: false };
  const vendorFilter = vendorId ? { partyId: vendorId } : {};
  const invoiceFilter = vendorId ? { vendorId } : {};

  const [pendingPOs, approvedPOs, completedPOs, totalPOs, totalInvoices, pendingPayments, vendors] = await Promise.all([
    prisma.businessDocument.count({ where: { ...vWhere, ...vendorFilter, status: { in: ["DRAFT", "SUBMITTED"] } } }),
    prisma.businessDocument.count({ where: { ...vWhere, ...vendorFilter, status: "APPROVED" } }),
    prisma.businessDocument.count({ where: { ...vWhere, ...vendorFilter, status: "CLOSED" } }),
    prisma.businessDocument.aggregate({ where: { ...vWhere, ...vendorFilter }, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "PURCHASE_INVOICE", isDeleted: false, ...vendorFilter }, _sum: { totalAmount: true }, _count: true }),
    prisma.payment.aggregate({ where: { tenantId, companyId, paymentType: "PAYMENT", isDeleted: false, ...(vendorId ? { partyId: vendorId } : {}) }, _sum: { amount: true }, _count: true }),
    vendorId ? [] : prisma.vendor.findMany({ where: { tenantId, companyId, isDeleted: false }, take: 5, select: { id: true, name: true } }),
  ]);

  return ok(res, {
    kpis: { pendingPOs, approvedPOs, completedPOs, totalPOs: totalPOs._count || 0, totalValue: totalPOs._sum.totalAmount || 0, totalInvoices: totalInvoices._count || 0, totalPayments: pendingPayments._count || 0, pendingAmount: pendingPayments._sum.amount || 0 },
    vendors: vendors || [],
  }, "Supplier portal dashboard");
}));

// ─── Supplier PO List ────────────────────────────────────────────
router.get("/supplier-portal/purchase-orders", requirePermission(PERMISSIONS.PURCHASE_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const { vendorId } = req.query;

  const where = { tenantId, companyId, documentType: "PURCHASE_ORDER", isDeleted: false };
  if (vendorId) where.partyId = vendorId;

  const [total, rows] = await Promise.all([
    prisma.businessDocument.count({ where }),
    prisma.businessDocument.findMany({ where, orderBy: { documentDate: "desc" }, take: 50, select: { id: true, documentNo: true, documentDate: true, status: true, totalAmount: true, partyId: true, terms: true } }),
  ]);

  // Enrich vendor names
  const vendorIds = [...new Set(rows.map((r) => r.partyId).filter(Boolean))];
  const vendors = vendorIds.length ? await prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } }) : [];
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  return ok(res, rows.map((r) => ({ ...r, vendorName: vendorMap.get(r.partyId)?.name || "—" })), "Supplier POs", { total });
}));

// ─── Supplier Invoice List ───────────────────────────────────────
router.get("/supplier-portal/invoices", requirePermission(PERMISSIONS.PURCHASE_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const { vendorId } = req.query;

  const where = { tenantId, companyId, documentType: "PURCHASE_INVOICE", isDeleted: false };
  if (vendorId) where.partyId = vendorId;

  const [total, rows] = await Promise.all([
    prisma.businessDocument.count({ where }),
    prisma.businessDocument.findMany({ where, orderBy: { documentDate: "desc" }, take: 50, select: { id: true, documentNo: true, documentDate: true, status: true, totalAmount: true, partyId: true, taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true } }),
  ]);

  return ok(res, rows, "Supplier invoices", { total });
}));

// ─── Supplier Payment History ────────────────────────────────────
router.get("/supplier-portal/payments", requirePermission(PERMISSIONS.PURCHASE_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const { vendorId } = req.query;

  const where = { tenantId, companyId, paymentType: "PAYMENT", isDeleted: false };
  if (vendorId) where.partyId = vendorId;

  const rows = await prisma.payment.findMany({ where, orderBy: { paymentDate: "desc" }, take: 50 });
  return ok(res, rows, "Supplier payments");
}));

// ─── Vendor List (for filtering) ─────────────────────────────────
router.get("/supplier-portal/vendors", requirePermission(PERMISSIONS.PURCHASE_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const vendors = await prisma.vendor.findMany({ where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false }, orderBy: { name: "asc" }, take: 100 });
  return ok(res, vendors, "Vendors loaded");
}));

export default router;