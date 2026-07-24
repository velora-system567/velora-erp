import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPrisma } from "../../config/db.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import { getStockBalances } from "../inventory/inventory.service.js";

const router = Router();
router.use(requireAuth, requireTenant);

// ─── WMS Dashboard ───────────────────────────────────────────────
router.get("/wms/dashboard", requirePermission(PERMISSIONS.INVENTORY_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;

  const [warehouses, locations, batches, transfers, adjustments, cycleCounts, lowStockAlert] = await Promise.all([
    prisma.warehouse.findMany({ where: { tenantId, companyId, isDeleted: false }, select: { id: true, name: true, warehouseType: true, capacity: true, isActive: true, _count: { select: { locations: true } } } }),
    prisma.inventoryLocation.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.stockBatch.findMany({ where: { tenantId, companyId, isDeleted: false, qtyRemaining: { gt: 0 } }, select: { warehouseId: true, qtyRemaining: true } }),
    prisma.stockTransfer.count({ where: { tenantId, companyId, isDeleted: false, status: { in: ["DRAFT", "SUBMITTED"] } } }),
    prisma.stockAdjustment.count({ where: { tenantId, companyId, isDeleted: false, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
    prisma.cycleCount.count({ where: { tenantId, companyId, isDeleted: false, status: "DRAFT" } }),
    prisma.item.count({ where: { tenantId, companyId, isDeleted: false, isActive: true, reorderLevel: { not: null } } }),
  ]);

  // Stock aggregation per warehouse
  const whStock = new Map();
  for (const b of batches) {
    const current = whStock.get(b.warehouseId) || 0;
    whStock.set(b.warehouseId, current + Number(b.qtyRemaining));
  }

  const warehouseSummary = warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.warehouseType,
    capacity: w.capacity,
    isActive: w.isActive,
    locationCount: w._count.locations,
    stockUnits: Number(whStock.get(w.id) || 0).toFixed(3),
    utilization: w.capacity ? Math.min(100, Math.round((Number(whStock.get(w.id) || 0) / Number(w.capacity)) * 100)) : 0,
  }));

  const totalStock = [...whStock.values()].reduce((s, v) => s + v, 0);

  return ok(res, {
    kpis: {
      totalWarehouses: warehouses.length,
      totalLocations: locations,
      totalStock: Number(totalStock).toFixed(3),
      pendingTransfers: transfers,
      recentAdjustments: adjustments,
      openCycleCounts: cycleCounts,
      lowStockItems: lowStockAlert,
    },
    warehouses: warehouseSummary,
  }, "WMS dashboard loaded");
}));

// ─── Warehouse Detail ─────────────────────────────────────────────
router.get("/wms/warehouses/:id", requirePermission(PERMISSIONS.INVENTORY_READ),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { tenantId, companyId } = req;
    const whId = req.params.id;

    const [warehouse, locations, balances, recentMovements] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: whId, tenantId, companyId, isDeleted: false } }),
      prisma.inventoryLocation.findMany({ where: { warehouseId: whId, tenantId, companyId, isDeleted: false }, orderBy: [{ zone: "asc" }, { code: "asc" }] }),
      getStockBalances(prisma, { tenantId, companyId, warehouseId: whId }),
      prisma.stockLedger.findMany({ where: { tenantId, companyId, warehouseId: whId, isDeleted: false }, orderBy: { createdAt: "desc" }, take: 20, include: { item: { select: { name: true, itemCode: true } } } }),
    ]);

    if (!warehouse) { const e = new Error("Warehouse not found"); e.statusCode = 404; throw e; }

    return ok(res, { warehouse, locations, balances: balances.slice(0, 50), recentMovements }, "Warehouse detail loaded");
  }));

// ─── Inventory Locations ─────────────────────────────────────────
router.get("/wms/locations", requirePermission(PERMISSIONS.INVENTORY_READ),
  validate(z.object({ query: z.object({ warehouseId: z.string().uuid().optional(), zone: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { warehouseId, zone } = req.validated.query;
    const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false };
    if (warehouseId) where.warehouseId = warehouseId;
    if (zone) where.zone = zone;
    const rows = await prisma.inventoryLocation.findMany({ where, orderBy: [{ warehouseId: "asc" }, { zone: "asc" }, { code: "asc" }] });
    return ok(res, rows, "Locations loaded");
  }));

router.post("/wms/locations", requirePermission(PERMISSIONS.INVENTORY_CREATE),
  validate(z.object({
    body: z.object({
      warehouseId: z.string().uuid(),
      parentId: z.string().uuid().optional(),
      code: z.string().min(1).max(60),
      name: z.string().min(2).max(120),
      zone: z.string().max(60).optional(),
      bin: z.string().max(60).optional(),
      capacity: z.coerce.number().positive().optional(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const input = req.validated.body;
    const wh = await prisma.warehouse.findFirst({ where: { id: input.warehouseId, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
    if (!wh) { const e = new Error("Warehouse not found"); e.statusCode = 404; throw e; }
    const loc = await prisma.inventoryLocation.create({
      data: { ...input, tenantId: req.tenantId, companyId: req.companyId, createdBy: req.user.sub, updatedBy: req.user.sub },
    });
    return created(res, loc, "Location created");
  }));

// ─── Stock Movements (Audit Log) ─────────────────────────────────
router.get("/wms/movements", requirePermission(PERMISSIONS.INVENTORY_READ),
  validate(z.object({
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).default(50).transform(v => Math.min(v, 500)),
      warehouseId: z.string().uuid().optional(),
      itemId: z.string().uuid().optional(),
      transactionType: z.string().optional(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { page, limit, warehouseId, itemId, transactionType } = req.validated.query;
    const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false };
    if (warehouseId) where.warehouseId = warehouseId;
    if (itemId) where.itemId = itemId;
    if (transactionType) where.transactionType = transactionType;

    const [total, rows] = await Promise.all([
      prisma.stockLedger.count({ where }),
      prisma.stockLedger.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" },
        include: { item: { select: { name: true, itemCode: true } }, warehouse: { select: { name: true } } },
      }),
    ]);
    return ok(res, rows, "Movements loaded", { page, limit, total, totalPages: Math.ceil(total / limit) });
  }));

export default router;
