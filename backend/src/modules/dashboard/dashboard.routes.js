import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
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
    const payload = {
      todaysSalesPaise: 0,
      todaysInvoiceCount: 0,
      monthlySalesPaise: 0,
      totalOutstandingPaise: 0,
      topDebtors: [],
      lowStockItems: [],
      gstPayablePaise: 0,
      pendingPurchaseOrders: 0,
      todaysCollectionsPaise: 0,
      grossProfitThisMonthPaise: 0,
    };
    await redis.set(cacheKey, JSON.stringify(payload), "EX", 900);
    return ok(res, payload, "Dashboard KPIs loaded");
  } catch (error) {
    return next(error);
  }
});

router.get("/sales-chart", (req, res) => ok(res, { rows: [] }, "Sales chart"));
router.get("/top-items", (req, res) => ok(res, { rows: [] }, "Top items"));

export default router;
