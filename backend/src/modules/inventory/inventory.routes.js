import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPrisma } from "../../config/db.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import {
  getStockBalances,
  processStockTransfer,
  processStockAdjustment,
  getLowStockAlerts,
  creditStock,
} from "./inventory.service.js";

const router = Router();
router.use(requireAuth, requireTenant);

const listQuery = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    warehouseId: z.string().uuid().optional(),
    itemId: z.string().uuid().optional(),
  }),
});

// ─── Stock Summary ────────────────────────────────────────────────────────────
router.get("/inventory/stock-summary", requirePermission(PERMISSIONS.INVENTORY_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { warehouseId } = req.validated.query;
  const balances = await getStockBalances(prisma, { tenantId: req.tenantId, companyId: req.companyId, warehouseId });

  // Enrich with item names
  const itemIds = [...new Set(balances.map((b) => b.itemId))];
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds }, isDeleted: false },
    select: { id: true, itemCode: true, name: true, unitOfMeasureId: true },
  });
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const rows = balances
    .map((b) => ({ ...b, item: itemMap.get(b.itemId) || null }))
    .filter((b) => b.quantity !== 0);

  return ok(res, rows, "Stock summary loaded");
}));

// ─── Stock Ledger for item ────────────────────────────────────────────────────
router.get("/inventory/stock-ledger/:itemId", requirePermission(PERMISSIONS.INVENTORY_READ),
  validate(z.object({ params: z.object({ itemId: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { page = 1, limit = 50 } = req.query;
    const where = { tenantId: req.tenantId, itemId: req.params.itemId, isDeleted: false };
    const [total, rows] = await Promise.all([
      prisma.stockLedger.count({ where }),
      prisma.stockLedger.findMany({ where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: { createdAt: "desc" } }),
    ]);
    return ok(res, rows, "Stock ledger loaded", { page: Number(page), limit: Number(limit), total });
  }));

// ─── Opening Stock ────────────────────────────────────────────────────────────
router.post("/inventory/opening-stock", requirePermission(PERMISSIONS.INVENTORY_CREATE),
  validate(z.object({
    body: z.object({
      warehouseId: z.string().uuid(),
      items: z.array(z.object({
        itemId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
        costRate: z.coerce.number().min(0),
        batchNumber: z.string().optional().or(z.literal("")),
      })).min(1),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const results = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of req.validated.body.items) {
        const { rupeesToPaise } = await import("../../utils/money.js");
        const result = await creditStock(tx, {
          tenantId: req.tenantId, companyId: req.companyId, branchId: req.branchId,
          itemId: item.itemId,
          warehouseId: req.validated.body.warehouseId,
          quantity: item.quantity,
          costRate: rupeesToPaise(item.costRate),
          referenceType: "OPENING",
          batchNumber: item.batchNumber || null,
          userId: req.user.sub,
        });
        results.push({ itemId: item.itemId, ...result });
      }
      return results;
    });
    return created(res, results, "Opening stock posted");
  }));

// ─── Stock Transfer ───────────────────────────────────────────────────────────
router.get("/inventory/stock-transfers", requirePermission(PERMISSIONS.INVENTORY_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const rows = await prisma.stockTransfer.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return ok(res, rows, "Stock transfers loaded");
}));

router.post("/inventory/stock-transfer", requirePermission(PERMISSIONS.INVENTORY_TRANSFER),
  validate(z.object({
    body: z.object({
      itemId: z.string().uuid(),
      fromWarehouseId: z.string().uuid(),
      toWarehouseId: z.string().uuid(),
      quantity: z.coerce.number().positive(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const input = req.validated.body;
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          tenantId: req.tenantId, companyId: req.companyId, branchId: req.branchId || null,
          itemId: input.itemId,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          quantity: input.quantity,
          status: "APPROVED",
          createdBy: req.user.sub, updatedBy: req.user.sub,
        },
      });
      await processStockTransfer(tx, req, { ...input, referenceId: transfer.id });
      return transfer;
    });
    return created(res, result, "Stock transfer completed");
  }));

// ─── Stock Adjustment ─────────────────────────────────────────────────────────
router.post("/inventory/stock-adjustment", requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  validate(z.object({
    body: z.object({
      itemId: z.string().uuid(),
      warehouseId: z.string().uuid(),
      adjustmentQty: z.coerce.number(),
      reason: z.string().min(3),
      costRate: z.coerce.number().min(0).optional(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const input = req.validated.body;
    const { rupeesToPaise } = await import("../../utils/money.js");
    await prisma.$transaction(async (tx) => {
      await processStockAdjustment(tx, req, {
        ...input,
        costRate: input.costRate ? rupeesToPaise(input.costRate) : 0,
      });
    });
    return ok(res, {}, "Stock adjustment posted");
  }));

// ─── Low Stock Alerts ─────────────────────────────────────────────────────────
router.get("/inventory/low-stock-alerts", requirePermission(PERMISSIONS.INVENTORY_READ), asyncHandler(async (req, res) => {
  const alerts = await getLowStockAlerts(req);
  return ok(res, alerts, "Low stock alerts");
}));

// ─── Valuation Report ─────────────────────────────────────────────────────────
router.get("/inventory/valuation-report", requirePermission(PERMISSIONS.INVENTORY_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const balances = await getStockBalances(prisma, { tenantId: req.tenantId, companyId: req.companyId });
  const itemIds = [...new Set(balances.map((b) => b.itemId))];
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds }, isDeleted: false },
    select: { id: true, itemCode: true, name: true },
  });
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const totalValue = balances.reduce((s, b) => s + b.valuePaise, 0);
  const rows = balances.map((b) => ({
    ...b,
    item: itemMap.get(b.itemId) || null,
    avgCostRate: b.quantity > 0 ? Math.round(b.valuePaise / b.quantity) : 0,
  }));
  return ok(res, { rows, totalValuePaise: totalValue }, "Valuation report");
}));

export default router;
