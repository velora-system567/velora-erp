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

const router = Router();
router.use(requireAuth, requireTenant);

// ─── EAM Dashboard ───────────────────────────────────────────────
router.get("/eam/dashboard", requirePermission(PERMISSIONS.MFG_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const { MFG_READ } = PERMISSIONS;

  const [totalAssets, activeAssets, maintenanceDue, maintenanceOverdue, totalMaintenance, recentTasks, assetsByType] = await Promise.all([
    prisma.machine.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.machine.count({ where: { tenantId, companyId, isDeleted: false, status: { notIn: ["RETIRED", "BROKEN", "DISPOSED"] } } }),
    prisma.machine.count({ where: { tenantId, companyId, isDeleted: false, maintenanceDue: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) } } }),
    prisma.machine.count({ where: { tenantId, companyId, isDeleted: false, maintenanceDue: { lt: new Date() } } }),
    prisma.maintenanceTask.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.maintenanceTask.findMany({ where: { tenantId, companyId, isDeleted: false }, orderBy: { createdAt: "desc" }, take: 10, include: { machine: { select: { name: true, machineCode: true } } } }),
    prisma.machine.groupBy({ by: ["status"], where: { tenantId, companyId, isDeleted: false }, _count: true }),
  ]);

  return ok(res, {
    kpis: { totalAssets, activeAssets, maintenanceDue, maintenanceOverdue, totalMaintenance },
    assetsByType: assetsByType.map((a) => ({ status: a.status, count: a._count })),
    recentActivity: recentTasks.map((t) => ({ id: t.id, taskNumber: t.taskNumber, taskType: t.taskType, status: t.status, assetName: t.machine?.name, assetCode: t.machine?.machineCode, scheduledDate: t.scheduledDate, description: t.description?.slice(0, 100) })),
  }, "EAM dashboard loaded");
}));

// ─── Assets List ─────────────────────────────────────────────────
router.get("/eam/assets", requirePermission(PERMISSIONS.MFG_READ),
  validate(z.object({ query: z.object({ page: z.coerce.number().min(1).default(1), limit: z.coerce.number().min(1).max(100).default(50), status: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { page, limit, status } = req.validated.query;
    const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false };
    if (status) where.status = status;

    const [total, rows] = await Promise.all([
      prisma.machine.count({ where }),
      prisma.machine.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: "asc" } }),
    ]);

    return ok(res, rows, "Assets loaded", { page, limit, total, totalPages: Math.ceil(total / limit) });
  }));

// ─── Asset Detail ────────────────────────────────────────────────
router.get("/eam/assets/:id", requirePermission(PERMISSIONS.MFG_READ),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const asset = await prisma.machine.findFirst({ where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
    if (!asset) { const e = new Error("Asset not found"); e.statusCode = 404; throw e; }

    const maintenanceRecords = await prisma.maintenanceTask.findMany({
      where: { tenantId: req.tenantId, companyId: req.companyId, machineId: asset.id, isDeleted: false },
      orderBy: { scheduledDate: "desc" },
      take: 20,
    });

    return ok(res, { ...asset, maintenanceRecords }, "Asset loaded");
  }));

// ─── Create Asset ────────────────────────────────────────────────
router.post("/eam/assets", requirePermission(PERMISSIONS.MFG_CREATE),
  validate(z.object({ body: z.object({ machineCode: z.string().min(1), name: z.string().min(2), type: z.string().optional(), location: z.string().optional(), status: z.string().default("IDLE") }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const asset = await prisma.machine.create({
      data: { ...req.validated.body, tenantId: req.tenantId, companyId: req.companyId, createdBy: req.user.sub, updatedBy: req.user.sub },
    });
    await writeAudit(req, { tableName: "machines", recordId: asset.id, action: "ASSET_CREATED", newValue: asset });
    return created(res, asset, "Asset created");
  }));

// ─── Update Asset ────────────────────────────────────────────────
router.patch("/eam/assets/:id", requirePermission(PERMISSIONS.MFG_UPDATE),
  validate(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ name: z.string().min(2).optional(), type: z.string().optional(), location: z.string().optional(), status: z.string().optional(), healthScore: z.coerce.number().min(0).max(100).optional(), utilizationPct: z.coerce.number().min(0).max(100).optional(), operatingHours: z.coerce.number().min(0).optional() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const asset = await prisma.machine.update({ where: { id: req.params.id }, data: { ...req.validated.body, updatedBy: req.user.sub } });
    await writeAudit(req, { tableName: "machines", recordId: asset.id, action: "ASSET_UPDATED", newValue: asset });
    return ok(res, asset, "Asset updated");
  }));

// ─── Maintenance Tasks ───────────────────────────────────────────
router.get("/eam/maintenance", requirePermission(PERMISSIONS.MFG_READ),
  validate(z.object({ query: z.object({ page: z.coerce.number().min(1).default(1), limit: z.coerce.number().min(1).max(100).default(50), status: z.string().optional(), machineId: z.string().uuid().optional() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { page, limit, status, machineId } = req.validated.query;
    const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false };
    if (status) where.status = status;
    if (machineId) where.machineId = machineId;

    const [total, rows] = await Promise.all([
      prisma.maintenanceTask.count({ where }),
      prisma.maintenanceTask.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { scheduledDate: "desc" }, include: { machine: { select: { name: true, machineCode: true, location: true } } } }),
    ]);
    return ok(res, rows.map((t) => ({ ...t, assetName: t.machine?.name, assetCode: t.machine?.machineCode, location: t.machine?.location })), "Maintenance tasks loaded", { page, limit, total, totalPages: Math.ceil(total / limit) });
  }));

router.post("/eam/maintenance", requirePermission(PERMISSIONS.MFG_CREATE),
  validate(z.object({ body: z.object({ machineId: z.string().uuid(), taskType: z.string().min(2), description: z.string().min(5), scheduledDate: z.string(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"), assignedTo: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { machineId, ...input } = req.validated.body;
    const taskNumber = `MT-${Date.now().toString(36).toUpperCase()}`;
    const task = await prisma.maintenanceTask.create({
      data: { ...input, machineId, taskNumber, tenantId: req.tenantId, companyId: req.companyId, createdBy: req.user.sub, updatedBy: req.user.sub, scheduledDate: new Date(input.scheduledDate) },
    });
    await writeAudit(req, { tableName: "maintenance_tasks", recordId: task.id, action: "MAINTENANCE_SCHEDULED", newValue: task });
    return created(res, task, "Maintenance task created");
  }));

// ─── Asset Statuses ──────────────────────────────────────────────
router.get("/eam/statuses", (req, res) => {
  return ok(res, ["IDLE", "RUNNING", "MAINTENANCE", "BREAKDOWN", "RETIRED", "BROKEN", "DISPOSED"], "Asset statuses");
});

export default router;