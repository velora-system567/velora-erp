import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getPrisma } from "../../config/db.js";
import { getRedis } from "../../config/redis.js";
import { ok } from "../../utils/api-response.js";

const router = Router();
router.use(requireAuth);

router.get("/kpis", async (req, res, next) => {
  try {
    const redis = getRedis();
    const cacheKey = `tenant:${req.tenantId}:company:${req.companyId}:dashboard:kpis`;
    const cached = await redis.get(cacheKey);
    if (cached) return ok(res, JSON.parse(cached), "Dashboard KPIs loaded from cache");
    const prisma = getPrisma();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [todaysSales, monthlySales, pendingPurchaseOrders] = await Promise.all([
      prisma.businessDocument.aggregate({
        where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "SALES", isDeleted: false, documentDate: { gte: today, lt: tomorrow } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.businessDocument.aggregate({
        where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "SALES", isDeleted: false, documentDate: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      prisma.businessDocument.count({ where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "PURCHASE", status: "DRAFT", isDeleted: false } }),
    ]);
    const payload = {
      todaysSalesPaise: todaysSales._sum.totalAmount || 0,
      todaysInvoiceCount: todaysSales._count || 0,
      monthlySalesPaise: monthlySales._sum.totalAmount || 0,
      totalOutstandingPaise: 0,
      topDebtors: [],
      lowStockItems: [],
      gstPayablePaise: 0,
      pendingPurchaseOrders,
      todaysCollectionsPaise: 0,
      grossProfitThisMonthPaise: 0,
    };
    await redis.set(cacheKey, JSON.stringify(payload), "EX", 900);
    return ok(res, payload, "Dashboard KPIs loaded");
  } catch (error) {
    return next(error);
  }
});

router.get("/sales-chart", async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    const records = await prisma.businessDocument.findMany({
      where: { tenantId: req.tenantId, companyId: req.companyId, documentType: "SALES", isDeleted: false, documentDate: { gte: start } },
      select: { documentDate: true, totalAmount: true },
      orderBy: { documentDate: "asc" },
    });
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date: date.toISOString().slice(0, 10), sales: 0 };
    });
    const byDate = new Map(days.map((day) => [day.date, day]));
    for (const record of records) {
      const key = record.documentDate.toISOString().slice(0, 10);
      if (byDate.has(key)) byDate.get(key).sales += record.totalAmount / 100;
    }
    return ok(res, { rows: days }, "Sales chart");
  } catch (error) {
    return next(error);
  }
});
router.get("/top-items", (req, res) => ok(res, { rows: [] }, "Top items"));

export default router;
