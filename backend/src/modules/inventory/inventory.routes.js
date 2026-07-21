import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPrisma } from "../../config/db.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import { writeAudit } from "../../utils/audit.js";
import {
  getStockBalances,
  processStockTransfer,
  processStockAdjustment,
  getLowStockAlerts,
  creditStock,
  getInventoryControlTower,
  getInventoryLedgerPage,
  getBatchTraceabilityReport,
  getStockBalance,
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

const ledgerQuery = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
    itemId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    transactionType: z.enum(["PURCHASE", "SALE", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT", "OPENING", "PRODUCTION_IN", "PRODUCTION_OUT"]).optional(),
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
  }),
});

async function assertTenantInventoryReference(prisma, req, { itemId, warehouseIds = [] }) {
  const checks = [
    prisma.item.findFirst({ where: { id: itemId, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false }, select: { id: true } }),
    ...warehouseIds.map((id) => prisma.warehouse.findFirst({ where: { id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false }, select: { id: true } })),
  ];
  const records = await Promise.all(checks);
  if (records.some((record) => !record)) {
    const error = new Error("Item or warehouse was not found in the active company");
    error.statusCode = 404;
    throw error;
  }
}

// ─── Inventory Control Tower ────────────────────────────────────────────────
router.get("/inventory/dashboard", requirePermission(PERMISSIONS.INVENTORY_READ),
  validate(z.object({ query: z.object({ warehouseId: z.string().uuid().optional() }) })),
  asyncHandler(async (req, res) => {
    const data = await getInventoryControlTower(getPrisma(), {
      tenantId: req.tenantId,
      companyId: req.companyId,
      warehouseId: req.validated.query.warehouseId,
    });
    return ok(res, data, "Inventory dashboard loaded");
  }));

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

// Rich, cross-item movement history used by audit, operational search, and exports.
router.get("/inventory/ledger", requirePermission(PERMISSIONS.INVENTORY_READ), validate(ledgerQuery), asyncHandler(async (req, res) => {
  const { rows, meta } = await getInventoryLedgerPage(getPrisma(), {
    tenantId: req.tenantId,
    companyId: req.companyId,
    ...req.validated.query,
  });
  return ok(res, rows, "Inventory movement history loaded", meta);
}));

router.get("/inventory/batches", requirePermission(PERMISSIONS.INVENTORY_READ),
  validate(z.object({ query: z.object({ warehouseId: z.string().uuid().optional(), status: z.enum(["ALL", "ACTIVE", "EXPIRED", "EXPIRING"]).default("ALL") }) })),
  asyncHandler(async (req, res) => {
    const rows = await getBatchTraceabilityReport(getPrisma(), {
      tenantId: req.tenantId,
      companyId: req.companyId,
      ...req.validated.query,
    });
    return ok(res, rows, "Batch traceability report loaded");
  }));

// ─── Warehouse locations, reservations, and cycle counts ───────────────────
router.get("/inventory/locations", requirePermission(PERMISSIONS.INVENTORY_READ),
  validate(z.object({ query: z.object({ warehouseId: z.string().uuid().optional() }) })),
  asyncHandler(async (req, res) => {
    const rows = await getPrisma().inventoryLocation.findMany({
      where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false, ...(req.validated.query.warehouseId ? { warehouseId: req.validated.query.warehouseId } : {}) },
      orderBy: [{ warehouseId: "asc" }, { code: "asc" }],
    });
    return ok(res, rows, "Storage locations loaded");
  }));

router.post("/inventory/locations", requirePermission(PERMISSIONS.INVENTORY_CREATE),
  validate(z.object({ body: z.object({ warehouseId: z.string().uuid(), parentId: z.string().uuid().optional(), code: z.string().min(1).max(60), name: z.string().min(2).max(120), zone: z.string().max(60).optional(), bin: z.string().max(60).optional(), capacity: z.coerce.number().positive().optional() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { warehouseId, ...input } = req.validated.body;
    const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false }, select: { id: true } });
    if (!warehouse) { const error = new Error("Warehouse was not found in the active company"); error.statusCode = 404; throw error; }
    const row = await prisma.inventoryLocation.create({ data: { ...input, warehouseId, tenantId: req.tenantId, companyId: req.companyId, createdBy: req.user.sub, updatedBy: req.user.sub } });
    await writeAudit(req, { tableName: "inventory_locations", recordId: row.id, action: "INVENTORY_LOCATION_CREATED", newValue: row });
    return created(res, row, "Storage location created");
  }));

router.get("/inventory/reservations", requirePermission(PERMISSIONS.INVENTORY_READ), asyncHandler(async (req, res) => {
  const rows = await getPrisma().inventoryReservation.findMany({ where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false }, orderBy: { createdAt: "desc" }, take: 100 });
  return ok(res, rows, "Stock reservations loaded");
}));

router.post("/inventory/reservations", requirePermission(PERMISSIONS.INVENTORY_UPDATE),
  validate(z.object({ body: z.object({ itemId: z.string().uuid(), warehouseId: z.string().uuid(), locationId: z.string().uuid().optional(), quantity: z.coerce.number().positive(), referenceId: z.string().uuid().optional(), referenceType: z.string().max(80).optional(), expiresAt: z.coerce.date().optional() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma(); const input = req.validated.body;
    await assertTenantInventoryReference(prisma, req, { itemId: input.itemId, warehouseIds: [input.warehouseId] });
    const [balance, reserved] = await Promise.all([
      getStockBalance(prisma, { tenantId: req.tenantId, itemId: input.itemId, warehouseId: input.warehouseId }),
      prisma.inventoryReservation.aggregate({ where: { tenantId: req.tenantId, companyId: req.companyId, itemId: input.itemId, warehouseId: input.warehouseId, status: "ACTIVE", isDeleted: false }, _sum: { quantity: true } }),
    ]);
    const available = balance.quantity - Number(reserved._sum.quantity || 0);
    if (available < Number(input.quantity)) { const error = new Error(`Insufficient available stock. Available after reservations: ${available}`); error.statusCode = 422; throw error; }
    const row = await prisma.inventoryReservation.create({ data: { ...input, tenantId: req.tenantId, companyId: req.companyId, branchId: req.branchId, createdBy: req.user.sub, updatedBy: req.user.sub } });
    await writeAudit(req, { tableName: "inventory_reservations", recordId: row.id, action: "STOCK_RESERVED", newValue: row });
    return created(res, row, "Stock reserved");
  }));

router.patch("/inventory/reservations/:id/release", requirePermission(PERMISSIONS.INVENTORY_UPDATE), validate(z.object({ params: z.object({ id: z.string().uuid() }) })), asyncHandler(async (req, res) => {
  const row = await getPrisma().inventoryReservation.updateMany({ where: { id: req.validated.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false }, data: { status: "RELEASED", updatedBy: req.user.sub } });
  if (!row.count) { const error = new Error("Reservation not found"); error.statusCode = 404; throw error; }
  await writeAudit(req, { tableName: "inventory_reservations", recordId: req.validated.params.id, action: "STOCK_RESERVATION_RELEASED", newValue: { status: "RELEASED" } });
  return ok(res, {}, "Stock reservation released");
}));

router.get("/inventory/serials", requirePermission(PERMISSIONS.INVENTORY_READ),
  validate(z.object({ query: z.object({ itemId: z.string().uuid().optional(), warehouseId: z.string().uuid().optional(), status: z.string().max(40).optional(), q: z.string().max(120).optional() }) })),
  asyncHandler(async (req, res) => {
    const { q, ...filters } = req.validated.query;
    const rows = await getPrisma().productSerial.findMany({
      where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false, ...filters, ...(q ? { serialNumber: { contains: q, mode: "insensitive" } } : {}) },
      orderBy: { createdAt: "desc" }, take: 500,
    });
    return ok(res, rows, "Serial traceability report loaded");
  }));

router.get("/inventory/cycle-counts", requirePermission(PERMISSIONS.INVENTORY_READ), asyncHandler(async (req, res) => {
  const rows = await getPrisma().cycleCount.findMany({ where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false }, orderBy: { createdAt: "desc" }, take: 100 });
  return ok(res, rows, "Cycle counts loaded");
}));

router.post("/inventory/cycle-counts", requirePermission(PERMISSIONS.INVENTORY_CREATE),
  validate(z.object({ body: z.object({ warehouseId: z.string().uuid(), scheduledAt: z.coerce.date().optional(), notes: z.string().max(2000).optional() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma(); const input = req.validated.body;
    const warehouse = await prisma.warehouse.findFirst({ where: { id: input.warehouseId, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false }, select: { id: true } });
    if (!warehouse) { const error = new Error("Warehouse was not found in the active company"); error.statusCode = 404; throw error; }
    const balances = await getStockBalances(prisma, { tenantId: req.tenantId, companyId: req.companyId, warehouseId: input.warehouseId });
    const countNumber = `CC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const cycleCount = await prisma.$transaction(async (tx) => {
      const header = await tx.cycleCount.create({ data: { tenantId: req.tenantId, companyId: req.companyId, branchId: req.branchId, warehouseId: input.warehouseId, countNumber, scheduledAt: input.scheduledAt, notes: input.notes, createdBy: req.user.sub, updatedBy: req.user.sub } });
      if (balances.length) await tx.cycleCountLine.createMany({ data: balances.map((balance) => ({ tenantId: req.tenantId, companyId: req.companyId, cycleCountId: header.id, itemId: balance.itemId, expectedQty: balance.quantity })) });
      return header;
    });
    await writeAudit(req, { tableName: "cycle_counts", recordId: cycleCount.id, action: "CYCLE_COUNT_CREATED", newValue: cycleCount });
    return created(res, cycleCount, "Cycle count created");
  }));

router.patch("/inventory/cycle-counts/:id/complete", requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  validate(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ lines: z.array(z.object({ lineId: z.string().uuid(), countedQty: z.coerce.number().min(0), notes: z.string().max(500).optional() })).min(1) }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma(); const input = req.validated.body;
    const count = await prisma.cycleCount.findFirst({ where: { id: req.validated.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
    if (!count || count.status === "COMPLETED") { const error = new Error("Cycle count was not found or has already been completed"); error.statusCode = 422; throw error; }
    await prisma.$transaction(async (tx) => {
      for (const entry of input.lines) {
        const line = await tx.cycleCountLine.findFirst({ where: { id: entry.lineId, cycleCountId: count.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
        if (!line) { const error = new Error("Cycle count line was not found"); error.statusCode = 404; throw error; }
        const variance = Number(entry.countedQty) - Number(line.expectedQty);
        await tx.cycleCountLine.update({ where: { id: line.id }, data: { countedQty: entry.countedQty, varianceQty: variance, notes: entry.notes || null } });
        if (variance !== 0) await processStockAdjustment(tx, req, { itemId: line.itemId, warehouseId: count.warehouseId, adjustmentQty: variance, reason: `Cycle count ${count.countNumber}${entry.notes ? `: ${entry.notes}` : ""}`, costRate: 0 });
      }
      await tx.cycleCount.update({ where: { id: count.id }, data: { status: "COMPLETED", completedAt: new Date(), updatedBy: req.user.sub } });
    });
    await writeAudit(req, { tableName: "cycle_counts", recordId: count.id, action: "CYCLE_COUNT_COMPLETED", newValue: { status: "COMPLETED" } });
    return ok(res, {}, "Cycle count completed and variances posted");
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
    for (const item of req.validated.body.items) {
      await assertTenantInventoryReference(prisma, req, { itemId: item.itemId, warehouseIds: [req.validated.body.warehouseId] });
    }
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
    await writeAudit(req, { tableName: "stock_ledger", recordId: results[0].itemId, action: "OPENING_STOCK_POSTED", newValue: { warehouseId: req.validated.body.warehouseId, lineCount: results.length } });
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
    if (input.fromWarehouseId === input.toWarehouseId) {
      const error = new Error("Source and destination warehouses must be different");
      error.statusCode = 422;
      throw error;
    }
    await assertTenantInventoryReference(prisma, req, { itemId: input.itemId, warehouseIds: [input.fromWarehouseId, input.toWarehouseId] });
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
    await writeAudit(req, { tableName: "stock_transfers", recordId: result.id, action: "STOCK_TRANSFER_COMPLETED", newValue: result });
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
    await assertTenantInventoryReference(prisma, req, { itemId: input.itemId, warehouseIds: [input.warehouseId] });
    const { rupeesToPaise } = await import("../../utils/money.js");
    await prisma.$transaction(async (tx) => {
      await processStockAdjustment(tx, req, {
        ...input,
        costRate: input.costRate ? rupeesToPaise(input.costRate) : 0,
      });
    });
    await writeAudit(req, { tableName: "stock_adjustments", recordId: input.itemId, action: "STOCK_ADJUSTMENT_POSTED", newValue: { ...input, adjustmentQty: Number(input.adjustmentQty) } });
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
