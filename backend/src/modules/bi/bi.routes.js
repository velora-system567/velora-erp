import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPrisma } from "../../config/db.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import { cachedCompute } from "../../utils/single-flight-cache.js";

const router = Router();
router.use(requireAuth, requireTenant);

// ─── Executive Dashboard ─────────────────────────────────────────
router.get("/bi/executive-dashboard", requirePermission(PERMISSIONS.REPORTS_READ), asyncHandler(async (req, res) => {
  const payload = await cachedCompute(`tenant:${req.tenantId}:company:${req.companyId}:bi:executive-dashboard`, 30, async () => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

  const [
    todayRevenue, monthlyRevenue, lastMonthRevenue,
    todayOrders, monthlyOrders, pendingOrders,
    newCustomers, totalCustomers, totalLeads,
    receivables, payables, gstPayable,
    totalInventory, totalWarehouses, pendingTransfers,
    totalProductionOrders, mfgPending,
    recentActivity,
  ] = await Promise.all([
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: todayStart } }, _sum: { totalAmount: true } }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: lastMonthStart, lt: monthStart } }, _sum: { totalAmount: true } }),
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false, createdAt: { gte: todayStart } } }),
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false, createdAt: { gte: monthStart } } }),
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false, status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } }),
    prisma.customer.count({ where: { tenantId, companyId, isDeleted: false, createdAt: { gte: monthStart } } }),
    prisma.customer.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.lead.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, status: { notIn: ["CANCELLED"] } }, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "PURCHASE_INVOICE", isDeleted: false, status: { notIn: ["CANCELLED"] } }, _sum: { totalAmount: true }, _count: true }),
    // JournalEntryLine has no `account` relation — resolve output-GST account IDs first
    prisma.chartOfAccount.findMany({ where: { tenantId, companyId, code: { in: ["2100", "2110", "2120"] }, isDeleted: false }, select: { id: true } })
      .then((accounts) => prisma.journalEntryLine.aggregate({ where: { tenantId, companyId, accountId: { in: accounts.map((a) => a.id) } }, _sum: { credit: true } })),
    prisma.stockBatch.aggregate({ where: { tenantId, companyId, isDeleted: false, qtyRemaining: { gt: 0 } }, _sum: { qtyRemaining: true } }),
    prisma.warehouse.count({ where: { tenantId, companyId, isDeleted: false, isActive: true } }),
    prisma.stockTransfer.count({ where: { tenantId, companyId, isDeleted: false, status: { in: ["DRAFT", "SUBMITTED"] } } }),
    prisma.productionOrder.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.productionOrder.count({ where: { tenantId, companyId, isDeleted: false, status: { in: ["DRAFT", "PLANNED", "IN_PROGRESS"] } } }),
    prisma.businessDocument.findMany({ where: { tenantId, companyId, isDeleted: false, updatedAt: { gte: thirtyDaysAgo } }, orderBy: { updatedAt: "desc" }, take: 15, select: { id: true, documentType: true, documentNo: true, totalAmount: true, status: true, updatedAt: true } }),
  ]);

  const todayRev = todayRevenue._sum.totalAmount || 0;
  const monthRev = monthlyRevenue._sum.totalAmount || 0;
  const lastRev = lastMonthRevenue._sum.totalAmount || 0;
  const revGrowth = lastRev > 0 ? Math.round(((monthRev - lastRev) / lastRev) * 100) : 0;

  // Compute business health score (0-100)
  const healthFactors = [];
  // Revenue health (30 pts max)
  if (monthRev > lastRev) healthFactors.push(30); else if (monthRev === lastRev) healthFactors.push(20); else healthFactors.push(Math.max(0, 30 - Math.abs(revGrowth)));
  // Orders health (20 pts max)
  const orderRatio = pendingOrders / Math.max(monthlyOrders, 1);
  if (orderRatio < 0.5) healthFactors.push(20); else if (orderRatio < 1) healthFactors.push(10); else healthFactors.push(5);
  // Receivables health (20 pts max)
  const recRatio = (receivables._sum.totalAmount || 0) / Math.max((receivables._count || 1) * 50000, 1);
  if (recRatio < 1) healthFactors.push(20); else if (recRatio < 2) healthFactors.push(10); else healthFactors.push(5);
  // Inventory health (15 pts max)
  const inventoryValue = Number(totalInventory._sum.qtyRemaining || 0);
  if (inventoryValue > 1000) healthFactors.push(15); else if (inventoryValue > 100) healthFactors.push(10); else healthFactors.push(5);
  // Customer health (15 pts max)
  if (newCustomers > 0) healthFactors.push(15); else healthFactors.push(5);

  const healthScore = Math.min(100, Math.max(0, healthFactors.reduce((a, b) => a + b, 0)));

  return {
    timestamp: now.toISOString(),
    health: {
      score: healthScore,
      status: healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 40 ? "Needs Attention" : "Critical",
      factors: { revenue: monthRev > lastRev, orders: orderRatio < 0.5, receivables: recRatio < 1, inventory: inventoryValue > 100, customers: newCustomers > 0 },
    },
    kpis: {
      todayRevenue: todayRev,
      monthlyRevenue: monthRev,
      revenueGrowth: revGrowth,
      monthlyOrders: monthlyOrders,
      todayOrders: todayOrders,
      pendingOrders,
      newCustomers,
      totalCustomers,
      totalLeads,
      receivables: receivables._sum.totalAmount || 0,
      payables: payables._sum.totalAmount || 0,
      gstPayable: Math.abs(gstPayable._sum.credit || 0),
      inventoryValue: Number(totalInventory._sum.qtyRemaining || 0).toFixed(0),
      totalWarehouses,
      pendingTransfers,
      totalProductionOrders,
      mfgPending,
      outstandingInvoices: receivables._count || 0,
    },
    growth: {
      revenue: revGrowth,
      customers: lastMonthStart > 0 ? Math.round(((newCustomers - 0) / Math.max(1, 0)) * 100) : 0,
    },
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      type: a.documentType,
      ref: a.documentNo,
      amount: a.totalAmount,
      status: a.status,
      time: a.updatedAt,
    })),
  };
  });
  return ok(res, payload, "Executive dashboard loaded");
}));

// ─── Department Scorecards ────────────────────────────────────────
router.get("/bi/departments", requirePermission(PERMISSIONS.REPORTS_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [salesRevenue, salesOrders, newLeads, purchaseOrders, totalItems, stockBatches, totalProduction, completedProduction, totalCustomers] = await Promise.all([
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false, createdAt: { gte: monthStart } } }),
    prisma.lead.count({ where: { tenantId, companyId, isDeleted: false, createdAt: { gte: monthStart } } }),
    prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "PURCHASE_ORDER", isDeleted: false, createdAt: { gte: monthStart } } }),
    prisma.item.count({ where: { tenantId, companyId, isDeleted: false, isActive: true } }),
    prisma.stockBatch.aggregate({ where: { tenantId, companyId, isDeleted: false, qtyRemaining: { gt: 0 } }, _sum: { qtyRemaining: true } }),
    prisma.productionOrder.count({ where: { tenantId, companyId, isDeleted: false, createdAt: { gte: monthStart } } }),
    prisma.productionOrder.count({ where: { tenantId, companyId, isDeleted: false, status: "COMPLETED", updatedAt: { gte: monthStart } } }),
    prisma.customer.count({ where: { tenantId, companyId, isDeleted: false } }),
  ]);

  const depts = [
    { name: "Sales", score: salesOrders > 0 ? 85 : 50, metric: `${salesOrders} orders`, revenue: salesRevenue._sum.totalAmount || 0, trend: salesOrders > 5 ? "up" : "flat" },
    { name: "Finance", score: 75, metric: `${salesRevenue._count || 0} invoices`, revenue: 0, trend: "flat" },
    { name: "Inventory", score: stockBatches._sum.qtyRemaining > 0 ? 80 : 50, metric: `${totalItems} SKUs`, revenue: 0, trend: "up" },
    { name: "Manufacturing", score: totalProduction > 0 ? Math.round((completedProduction / totalProduction) * 100) : 50, metric: `${totalProduction} orders`, revenue: 0, trend: totalProduction > 0 ? "up" : "flat" },
    { name: "CRM", score: newLeads > 0 ? 80 : 50, metric: `${totalCustomers} customers`, revenue: 0, trend: newLeads > 0 ? "up" : "flat" },
  ];

  return ok(res, depts, "Department scorecards loaded");
}));

// ─── Business Insights ────────────────────────────────────────────
router.get("/bi/insights", requirePermission(PERMISSIONS.REPORTS_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const insights = [];

  try {
    // Revenue comparison
    const [thisMonth, lastMonth] = await Promise.all([
      prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true } }),
      prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: lastMonthStart, lt: monthStart } }, _sum: { totalAmount: true } }),
    ]);
    const tm = thisMonth._sum.totalAmount || 0, lm = lastMonth._sum.totalAmount || 0;
    if (lm > 0) insights.push({ type: tm > lm ? "positive" : "warning", icon: "trendingUp", title: "Revenue", message: `Revenue ${tm > lm ? "increased" : "decreased"} ${Math.round(Math.abs((tm - lm) / lm * 100))}% compared to last month.` });
  } catch { /* skip */ }

  try {
    // Top product
    const topProduct = await prisma.businessDocumentLine.groupBy({ by: ["itemId"], where: { tenantId, companyId, document: { documentType: "INVOICE", documentDate: { gte: monthStart }, isDeleted: false }, isDeleted: false, itemId: { not: null } }, _sum: { lineTotal: true }, orderBy: { _sum: { lineTotal: "desc" } }, take: 1 });
    if (topProduct.length > 0) {
      const item = await prisma.item.findUnique({ where: { id: topProduct[0].itemId }, select: { name: true } });
      insights.push({ type: "positive", icon: "star", title: "Top Product", message: `"${item?.name || "Unknown"}" generated the most revenue this month.` });
    }
  } catch { /* skip */ }

  try {
    // Overdue invoices
    const overdue = await prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, status: { notIn: ["CANCELLED"] }, documentDate: { lt: new Date(now.getTime() - 30 * 86400000) } } });
    if (overdue > 0) insights.push({ type: "warning", icon: "alert", title: "Overdue", message: `${overdue} invoice${overdue > 1 ? "s are" : " is"} overdue by more than 30 days.` });
  } catch { /* skip */ }

  try {
    // Inactive customers
    const activeCustomerIds = (await prisma.businessDocument.findMany({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: new Date(now.getTime() - 60 * 86400000) } }, select: { partyId: true }, distinct: ["partyId"] })).map((d) => d.partyId).filter(Boolean);
    const inactiveCount = await prisma.customer.count({ where: { tenantId, companyId, isDeleted: false, id: { notIn: activeCustomerIds } } });
    if (inactiveCount > 0) insights.push({ type: "warning", icon: "users", title: "Inactive Customers", message: `${inactiveCount} customer${inactiveCount > 1 ? "s haven't" : " hasn't"} purchased in 60+ days. Consider re-engagement.` });
  } catch { /* skip */ }

  if (insights.length === 0) insights.push({ type: "info", icon: "check", title: "All Clear", message: "No significant issues detected. Your business is running smoothly." });

  return ok(res, insights, "Business insights loaded");
}));

// ─── Revenue Analytics ────────────────────────────────────────────
router.get("/bi/revenue-analytics", requirePermission(PERMISSIONS.REPORTS_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const months = 12;
  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(); start.setMonth(start.getMonth() - i); start.setDate(1); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setMonth(end.getMonth() + 1);

    const [revenue, expenses, orders] = await Promise.all([
      prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: start, lt: end } }, _sum: { totalAmount: true }, _count: true }),
      prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "PURCHASE_INVOICE", isDeleted: false, documentDate: { gte: start, lt: end } }, _sum: { totalAmount: true } }),
      prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false, createdAt: { gte: start, lt: end } } }),
    ]);
    const rev = revenue._sum.totalAmount || 0;
    const exp = expenses._sum.totalAmount || 0;
    result.push({ month: start.toLocaleString("en-US", { month: "short", year: "2-digit" }), revenue: rev, expenses: exp, profit: rev - exp, orders });
  }

  return ok(res, result, "Revenue analytics loaded");
}));

export default router;
