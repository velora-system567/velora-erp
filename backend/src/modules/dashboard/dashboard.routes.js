import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { getPrisma } from "../../config/db.js";
import { getRedis } from "../../config/redis.js";
import { ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { paiseToRupees } from "../../utils/money.js";
import { PERMISSIONS } from "../../utils/permissions.js";

const router = Router();
router.use(requireAuth, requireTenant);

router.get("/kpis", requirePermission(PERMISSIONS.DASHBOARD_READ), asyncHandler(async (req, res) => {
  const redis = getRedis();
  const cacheKey = `tenant:${req.tenantId}:company:${req.companyId}:dashboard:kpis`;

  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return ok(res, JSON.parse(cached), "Dashboard KPIs loaded from cache");

  const prisma = getPrisma();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todaysSales, monthlySales, pendingPurchaseOrders, payments, lowStockResult] = await Promise.all([
    prisma.businessDocument.aggregate({
      where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: today, lt: tomorrow } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.businessDocument.aggregate({
      where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } },
      _sum: { totalAmount: true },
    }),
    prisma.businessDocument.count({
      where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "PURCHASE_ORDER", status: "DRAFT", isDeleted: false },
    }),
    prisma.payment.aggregate({
      where: { tenantId: req.tenantId, companyId: req.companyId, paymentType: "RECEIPT", isDeleted: false, paymentDate: { gte: today, lt: tomorrow } },
      _sum: { amount: true },
    }),
    // Low stock: items below reorder level
    prisma.$queryRaw`
      SELECT COUNT(*)::int as count
      FROM items i
      WHERE i.tenant_id = ${req.tenantId}::uuid
        AND i.company_id = ${req.companyId}::uuid
        AND i.is_deleted = false
        AND i.reorder_level IS NOT NULL
        AND (
          SELECT COALESCE(SUM(sl.quantity), 0)
          FROM stock_ledger sl
          WHERE sl.tenant_id = i.tenant_id
            AND sl.item_id = i.id
            AND sl.is_deleted = false
        ) <= i.reorder_level
    `.then((r) => r).catch(() => [{ count: 0 }]),
  ]);

  // Outstanding receivables
  const [invoiceTotal, paidTotal] = await Promise.all([
    prisma.businessDocument.aggregate({
      where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "INVOICE", status: { notIn: ["CANCELLED"] }, isDeleted: false },
      _sum: { totalAmount: true },
    }),
    prisma.paymentAllocation.aggregate({
      where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
      _sum: { amount: true },
    }),
  ]);

  const payload = {
    todaysSalesPaise: todaysSales._sum.totalAmount || 0,
    todaysInvoiceCount: todaysSales._count || 0,
    monthlySalesPaise: monthlySales._sum.totalAmount || 0,
    todaysCollectionsPaise: payments._sum.amount || 0,
    totalOutstandingPaise: Math.max(0, (invoiceTotal._sum.totalAmount || 0) - (paidTotal._sum.amount || 0)),
    lowStockItemCount: lowStockResult?.[0]?.count || 0,
    pendingPurchaseOrders,
    gstPayablePaise: 0,
  };

  await redis.set(cacheKey, JSON.stringify(payload), "EX", 300).catch(() => {});
  return ok(res, payload, "Dashboard KPIs loaded");
}));

router.get("/sales-chart", requirePermission(PERMISSIONS.DASHBOARD_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  const records = await prisma.businessDocument.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: start } },
    select: { documentDate: true, totalAmount: true },
    orderBy: { documentDate: "asc" },
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start); date.setDate(start.getDate() + i);
    return { date: date.toISOString().slice(0, 10), sales: 0 };
  });

  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const r of records) {
    const key = r.documentDate.toISOString().slice(0, 10);
    if (byDate.has(key)) byDate.get(key).sales += paiseToRupees(r.totalAmount);
  }

  return ok(res, { rows: days }, "Sales chart");
}));

router.get("/top-items", requirePermission(PERMISSIONS.DASHBOARD_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  // Top items by invoice line totals this month
  const lines = await prisma.businessDocumentLine.findMany({
    where: {
      tenantId: req.tenantId, companyId: req.companyId, isDeleted: false,
      itemId: { not: null },
      document: { documentType: "INVOICE", documentDate: { gte: monthStart }, isDeleted: false },
    },
    select: { itemId: true, lineTotal: true },
  });

  const totals = new Map();
  for (const l of lines) {
    totals.set(l.itemId, (totals.get(l.itemId) || 0) + l.lineTotal);
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const itemIds = sorted.map(([id]) => id);
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, itemCode: true, name: true } });
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const rows = sorted.map(([itemId, total]) => ({
    item: itemMap.get(itemId) || { id: itemId },
    totalSalesPaise: total,
  }));

  return ok(res, { rows }, "Top items");
}));

export default router;
