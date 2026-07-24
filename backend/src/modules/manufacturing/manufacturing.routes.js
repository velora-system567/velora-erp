/**
 * Velora ERP — Manufacturing Module Routes
 * BOMs, Production Orders, Work Orders, Machines, Maintenance, Quality Checks
 */
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
import { nextDocNumber } from "../../utils/doc-number.js";
import { rupeesToPaise } from "../../utils/money.js";
import { updateTenantRecord } from "../../utils/tenant-record.js";

const router = Router();
router.use(requireAuth, requireTenant);

const listQuery = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).default(20).transform(v => Math.min(v, 500)),
    status: z.string().optional(),
    q: z.string().optional(),
  }),
});

const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

// ─── MODULE ACCESS CHECK ─────────────────────────────────────────────────────
router.get("/manufacturing/access", requirePermission(PERMISSIONS.MFG_READ), asyncHandler(async (req, res) => {
  return ok(res, { locked: false, module: "MANUFACTURING" }, "Manufacturing module accessible");
}));

// ─── BOM ─────────────────────────────────────────────────────────────────────
router.get("/manufacturing/boms", requirePermission(PERMISSIONS.MFG_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { page, limit } = req.validated.query;
  const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false };
  const [total, rows] = await Promise.all([
    prisma.bom.count({ where }),
    prisma.bom.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        lines: { where: { isDeleted: false } },
      },
    }),
  ]);
  return ok(res, rows, "BOMs loaded", { page, limit, total });
}));

router.post("/manufacturing/boms", requirePermission(PERMISSIONS.MFG_CREATE),
  validate(z.object({
    body: z.object({
      itemId: z.string().uuid(),
      version: z.string().default("v1.0"),
      isDefault: z.boolean().default(false),
      notes: z.string().optional().or(z.literal("")),
      lines: z.array(z.object({
        componentId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
        unitOfMeasureId: z.string().uuid().optional(),
        scrapPercent: z.coerce.number().int().min(0).max(100).default(0),
      })).min(1),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { tenantId, companyId } = req;
    const userId = req.user.sub;
    const input = req.validated.body;

    const bom = await prisma.$transaction(async (tx) => {
      const newBom = await tx.bom.create({
        data: {
          tenantId, companyId,
          itemId: input.itemId,
          version: input.version,
          isDefault: input.isDefault,
          notes: input.notes || null,
          createdBy: userId, updatedBy: userId,
        },
      });
      await tx.bomLine.createMany({
        data: input.lines.map((l) => ({
          tenantId,
          bomId: newBom.id,
          componentId: l.componentId,
          quantity: l.quantity,
          unitOfMeasureId: l.unitOfMeasureId || null,
          scrapPercent: l.scrapPercent,
        })),
      });
      await writeAudit(req, { tx, tableName: "boms", recordId: newBom.id, action: "BOM_CREATED", newValue: newBom });
      return tx.bom.findUnique({ where: { id: newBom.id }, include: { lines: { where: { isDeleted: false } } } });
    });
    return created(res, bom, "BOM created");
  }));

router.get("/manufacturing/boms/:id", requirePermission(PERMISSIONS.MFG_READ), validate(idParam), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const bom = await prisma.bom.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    include: { lines: { where: { isDeleted: false } } },
  });
  if (!bom) { const e = new Error("BOM not found"); e.statusCode = 404; throw e; }
  return ok(res, bom, "BOM loaded");
}));

router.delete("/manufacturing/boms/:id", requirePermission(PERMISSIONS.MFG_UPDATE), validate(idParam), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const bom = await updateTenantRecord(prisma, "bom", req, req.params.id,
    { isDeleted: true, updatedBy: req.user.sub }, { notFoundMessage: "BOM not found" });
  await writeAudit(req, { tableName: "boms", recordId: bom.id, action: "BOM_DELETED", newValue: bom });
  return ok(res, bom, "BOM deleted");
}));

// ─── PRODUCTION ORDERS ───────────────────────────────────────────────────────
router.get("/manufacturing/production-orders", requirePermission(PERMISSIONS.MFG_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { page, limit, status } = req.validated.query;
  const where = {
    tenantId: req.tenantId, companyId: req.companyId, isDeleted: false,
    ...(status ? { status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.productionOrder.count({ where }),
    prisma.productionOrder.findMany({
      where, skip: (page - 1) * limit, take: limit,
      orderBy: { createdAt: "desc" },
      include: { workOrders: { where: { isDeleted: false }, select: { id: true, status: true, completedQty: true, plannedQty: true } } },
    }),
  ]);
  return ok(res, rows, "Production orders loaded", { page, limit, total });
}));

router.post("/manufacturing/production-orders", requirePermission(PERMISSIONS.MFG_CREATE),
  validate(z.object({
    body: z.object({
      itemId: z.string().uuid(),
      bomId: z.string().uuid().optional(),
      quantity: z.coerce.number().positive(),
      plannedStart: z.string().optional(),
      plannedEnd: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
      assignedTo: z.string().optional().or(z.literal("")),
      warehouseId: z.string().uuid().optional(),
      notes: z.string().optional().or(z.literal("")),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { tenantId, companyId, branchId } = req;
    const userId = req.user.sub;
    const input = req.validated.body;

    const po = await prisma.$transaction(async (tx) => {
      const poNumber = await nextDocNumber({ tx, tenantId, companyId, docType: "MFG" });

      // Snapshot BOM if provided
      let bomSnapshot = null;
      if (input.bomId) {
        const bom = await tx.bom.findFirst({
          where: { id: input.bomId, tenantId, isDeleted: false },
          include: { lines: { where: { isDeleted: false } } },
        });
        if (bom) bomSnapshot = bom;
      }

      const newPo = await tx.productionOrder.create({
        data: {
          tenantId, companyId, branchId: branchId || null,
          poNumber,
          itemId: input.itemId,
          bomId: input.bomId || null,
          quantity: input.quantity,
          plannedStart: input.plannedStart ? new Date(input.plannedStart) : null,
          plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : null,
          priority: input.priority,
          assignedTo: input.assignedTo || null,
          warehouseId: input.warehouseId || null,
          notes: input.notes || null,
          bomSnapshot,
          status: "DRAFT",
          createdBy: userId, updatedBy: userId,
        },
      });
      await writeAudit(req, { tx, tableName: "production_orders", recordId: newPo.id, action: "PRODUCTION_ORDER_CREATED", newValue: newPo });
      return newPo;
    });
    return created(res, po, "Production order created");
  }));

router.get("/manufacturing/production-orders/:id", requirePermission(PERMISSIONS.MFG_READ), validate(idParam), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const po = await prisma.productionOrder.findFirst({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    include: {
      workOrders: { where: { isDeleted: false }, include: { qualityChecks: { where: { isDeleted: false } } } },
    },
  });
  if (!po) { const e = new Error("Production order not found"); e.statusCode = 404; throw e; }
  return ok(res, po, "Production order loaded");
}));

router.patch("/manufacturing/production-orders/:id/status", requirePermission(PERMISSIONS.MFG_UPDATE),
  validate(z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      status: z.enum(["DRAFT", "PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
      progress: z.coerce.number().min(0).max(100).optional(),
      actualStart: z.string().optional(),
      actualEnd: z.string().optional(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { status, progress, actualStart, actualEnd } = req.validated.body;
    const data = {
      status, updatedBy: req.user.sub,
      ...(progress !== undefined ? { progress } : {}),
      ...(actualStart ? { actualStart: new Date(actualStart) } : {}),
      ...(actualEnd ? { actualEnd: new Date(actualEnd) } : {}),
    };
    const po = await updateTenantRecord(prisma, "productionOrder", req, req.params.id, data,
      { notFoundMessage: "Production order not found" });
    await writeAudit(req, { tableName: "production_orders", recordId: po.id, action: `PRODUCTION_ORDER_${status}`, newValue: po });
    return ok(res, po, "Production order updated");
  }));

// ─── WORK ORDERS ──────────────────────────────────────────────────────────────
router.get("/manufacturing/work-orders", requirePermission(PERMISSIONS.MFG_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { page, limit, status } = req.validated.query;
  const where = {
    tenantId: req.tenantId, companyId: req.companyId, isDeleted: false,
    ...(status ? { status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
  ]);
  return ok(res, rows, "Work orders loaded", { page, limit, total });
}));

router.post("/manufacturing/work-orders", requirePermission(PERMISSIONS.MFG_CREATE),
  validate(z.object({
    body: z.object({
      productionOrderId: z.string().uuid(),
      operationName: z.string().min(2),
      machineId: z.string().uuid().optional(),
      plannedQty: z.coerce.number().positive(),
      assignedTo: z.string().optional().or(z.literal("")),
      notes: z.string().optional().or(z.literal("")),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { tenantId, companyId, branchId } = req;
    const userId = req.user.sub;
    const input = req.validated.body;

    const wo = await prisma.$transaction(async (tx) => {
      const woNumber = await nextDocNumber({ tx, tenantId, companyId, docType: "WO" });
      const newWo = await tx.workOrder.create({
        data: {
          tenantId, companyId,
          productionOrderId: input.productionOrderId,
          woNumber,
          operationName: input.operationName,
          machineId: input.machineId || null,
          plannedQty: input.plannedQty,
          assignedTo: input.assignedTo || null,
          notes: input.notes || null,
          status: "PENDING",
          createdBy: userId, updatedBy: userId,
        },
      });
      await writeAudit(req, { tx, tableName: "work_orders", recordId: newWo.id, action: "WORK_ORDER_CREATED", newValue: newWo });
      return newWo;
    });
    return created(res, wo, "Work order created");
  }));

router.patch("/manufacturing/work-orders/:id/complete", requirePermission(PERMISSIONS.MFG_UPDATE),
  validate(z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      completedQty: z.coerce.number().positive(),
      scrapQty: z.coerce.number().min(0).default(0),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { completedQty, scrapQty } = req.validated.body;
    const wo = await updateTenantRecord(prisma, "workOrder", req, req.params.id,
      {
        status: "COMPLETED",
        completedQty, scrapQty,
        completedAt: new Date(),
        updatedBy: req.user.sub,
      }, { notFoundMessage: "Work order not found" });
    return ok(res, wo, "Work order completed");
  }));

// ─── MACHINES ─────────────────────────────────────────────────────────────────
router.get("/manufacturing/machines", requirePermission(PERMISSIONS.MFG_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { page, limit } = req.validated.query;
  const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false };
  const [total, rows] = await Promise.all([
    prisma.machine.count({ where }),
    prisma.machine.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { machineCode: "asc" } }),
  ]);
  return ok(res, rows, "Machines loaded", { page, limit, total });
}));

router.post("/manufacturing/machines", requirePermission(PERMISSIONS.MFG_CREATE),
  validate(z.object({
    body: z.object({
      machineCode: z.string().min(1).max(30),
      name: z.string().min(2),
      type: z.string().optional().or(z.literal("")),
      location: z.string().optional().or(z.literal("")),
      maintenanceDue: z.string().optional(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const machine = await prisma.machine.create({
      data: {
        tenantId: req.tenantId, companyId: req.companyId,
        machineCode: req.validated.body.machineCode,
        name: req.validated.body.name,
        type: req.validated.body.type || null,
        location: req.validated.body.location || null,
        maintenanceDue: req.validated.body.maintenanceDue ? new Date(req.validated.body.maintenanceDue) : null,
        createdBy: req.user.sub, updatedBy: req.user.sub,
      },
    });
    return created(res, machine, "Machine created");
  }));

router.patch("/manufacturing/machines/:id/status", requirePermission(PERMISSIONS.MFG_UPDATE),
  validate(z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ status: z.enum(["RUNNING", "IDLE", "MAINTENANCE", "BREAKDOWN"]) }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const machine = await updateTenantRecord(prisma, "machine", req, req.params.id,
      { status: req.validated.body.status, updatedBy: req.user.sub }, { notFoundMessage: "Machine not found" });
    await writeAudit(req, { tableName: "machines", recordId: machine.id, action: "MACHINE_STATUS_UPDATED", newValue: machine });
    return ok(res, machine, "Machine status updated");
  }));

// ─── MAINTENANCE ──────────────────────────────────────────────────────────────
router.get("/manufacturing/maintenance", requirePermission(PERMISSIONS.MFG_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { page, limit, status } = req.validated.query;
  const where = {
    tenantId: req.tenantId, companyId: req.companyId, isDeleted: false,
    ...(status ? { status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.maintenanceTask.count({ where }),
    prisma.maintenanceTask.findMany({
      where, skip: (page - 1) * limit, take: limit,
      orderBy: { scheduledDate: "asc" },
      include: { machine: { select: { id: true, machineCode: true, name: true } } },
    }),
  ]);
  return ok(res, rows, "Maintenance tasks loaded", { page, limit, total });
}));

router.post("/manufacturing/maintenance", requirePermission(PERMISSIONS.MFG_CREATE),
  validate(z.object({
    body: z.object({
      machineId: z.string().uuid(),
      taskType: z.enum(["PREVENTIVE", "CORRECTIVE", "PREDICTIVE"]),
      description: z.string().min(3),
      scheduledDate: z.string(),
      assignedTo: z.string().optional().or(z.literal("")),
      costEstimate: z.coerce.number().min(0).default(0),
      notes: z.string().optional().or(z.literal("")),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { tenantId, companyId } = req;
    const userId = req.user.sub;
    const input = req.validated.body;

    const task = await prisma.$transaction(async (tx) => {
      const taskNumber = await nextDocNumber({ tx, tenantId, companyId, docType: "MNT" });
      return tx.maintenanceTask.create({
        data: {
          tenantId, companyId,
          machineId: input.machineId,
          taskNumber,
          taskType: input.taskType,
          description: input.description,
          scheduledDate: new Date(input.scheduledDate),
          assignedTo: input.assignedTo || null,
          costPaise: rupeesToPaise(input.costEstimate),
          notes: input.notes || null,
          status: "SCHEDULED",
          createdBy: userId, updatedBy: userId,
        },
      });
    });
    return created(res, task, "Maintenance task scheduled");
  }));

router.patch("/manufacturing/maintenance/:id/complete", requirePermission(PERMISSIONS.MFG_UPDATE),
  validate(z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      actualCost: z.coerce.number().min(0).default(0),
      notes: z.string().optional().or(z.literal("")),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const task = await updateTenantRecord(prisma, "maintenanceTask", req, req.params.id,
      {
        status: "COMPLETED",
        completedDate: new Date(),
        costPaise: rupeesToPaise(req.validated.body.actualCost),
        notes: req.validated.body.notes || null,
        updatedBy: req.user.sub,
      }, { notFoundMessage: "Maintenance task not found" });
    await writeAudit(req, { tableName: "maintenance_tasks", recordId: task.id, action: "MAINTENANCE_COMPLETED", newValue: task });
    return ok(res, task, "Maintenance task completed");
  }));

// ─── QUALITY CHECKS ───────────────────────────────────────────────────────────
router.get("/manufacturing/quality-checks", requirePermission(PERMISSIONS.MFG_READ), validate(listQuery), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { page, limit } = req.validated.query;
  const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false };
  const [total, rows] = await Promise.all([
    prisma.qualityCheck.count({ where }),
    prisma.qualityCheck.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { checkedAt: "desc" } }),
  ]);
  return ok(res, rows, "Quality checks loaded", { page, limit, total });
}));

router.post("/manufacturing/quality-checks", requirePermission(PERMISSIONS.MFG_QUALITY),
  validate(z.object({
    body: z.object({
      workOrderId: z.string().uuid(),
      inspectedQty: z.coerce.number().positive(),
      passedQty: z.coerce.number().min(0),
      failedQty: z.coerce.number().min(0),
      reworkQty: z.coerce.number().min(0).default(0),
      defects: z.array(z.object({ code: z.string(), label: z.string(), count: z.number() })).optional(),
      inspector: z.string().optional().or(z.literal("")),
      notes: z.string().optional().or(z.literal("")),
    }),
  })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { tenantId, companyId } = req;
    const userId = req.user.sub;
    const input = req.validated.body;
    const passRate = input.passedQty / input.inspectedQty;
    const result = passRate >= 0.95 ? "PASS" : input.reworkQty > 0 ? "REWORK" : "FAIL";

    const qc = await prisma.$transaction(async (tx) => {
      const qcNumber = await nextDocNumber({ tx, tenantId, companyId, docType: "QC" });
      return tx.qualityCheck.create({
        data: {
          tenantId, companyId,
          workOrderId: input.workOrderId,
          qcNumber,
          inspectedQty: input.inspectedQty,
          passedQty: input.passedQty,
          failedQty: input.failedQty,
          reworkQty: input.reworkQty,
          result,
          defects: input.defects || [],
          inspector: input.inspector || null,
          notes: input.notes || null,
          createdBy: userId, updatedBy: userId,
        },
      });
    });
    return created(res, qc, "Quality check recorded");
  }));

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
router.get("/manufacturing/analytics", requirePermission(PERMISSIONS.MFG_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;

  const [ordersByStatus, maintenanceByType, qualityStats, machineStats] = await Promise.all([
    prisma.productionOrder.groupBy({
      by: ["status"],
      where: { tenantId, companyId, isDeleted: false },
      _count: true,
    }),
    prisma.maintenanceTask.groupBy({
      by: ["taskType", "status"],
      where: { tenantId, companyId, isDeleted: false },
      _count: true,
      _sum: { costPaise: true },
    }),
    prisma.qualityCheck.aggregate({
      where: { tenantId, companyId, isDeleted: false },
      _sum: { inspectedQty: true, passedQty: true, failedQty: true },
      _count: true,
    }),
    prisma.machine.groupBy({
      by: ["status"],
      where: { tenantId, companyId, isDeleted: false },
      _count: true,
    }),
  ]);

  const totalInspected = Number(qualityStats._sum.inspectedQty || 0);
  const totalPassed = Number(qualityStats._sum.passedQty || 0);
  const overallPassRate = totalInspected > 0 ? ((totalPassed / totalInspected) * 100).toFixed(2) : 0;

  return ok(res, {
    productionOrders: ordersByStatus,
    maintenance: maintenanceByType,
    quality: {
      totalInspected,
      totalPassed,
      totalFailed: Number(qualityStats._sum.failedQty || 0),
      passRatePct: overallPassRate,
      totalChecks: qualityStats._count,
    },
    machines: machineStats,
  }, "Manufacturing analytics loaded");
}));

// ─── DASHBOARD KPIs ───────────────────────────────────────────────────────────
router.get("/manufacturing/dashboard", requirePermission(PERMISSIONS.MFG_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const [activeOrders, completedOrders, delayedOrders, pendingMaintenance, recentQC] = await Promise.all([
    prisma.productionOrder.count({ where: { tenantId, companyId, status: { in: ["IN_PROGRESS", "PLANNED"] }, isDeleted: false } }),
    prisma.productionOrder.count({ where: { tenantId, companyId, status: "COMPLETED", isDeleted: false } }),
    prisma.productionOrder.count({ where: { tenantId, companyId, plannedEnd: { lt: today }, status: { notIn: ["COMPLETED", "CANCELLED"] }, isDeleted: false } }),
    prisma.maintenanceTask.count({ where: { tenantId, companyId, status: { in: ["SCHEDULED", "IN_PROGRESS"] }, scheduledDate: { lte: tomorrow }, isDeleted: false } }),
    prisma.qualityCheck.aggregate({
      where: { tenantId, companyId, isDeleted: false },
      _sum: { inspectedQty: true, passedQty: true },
    }),
  ]);

  const inspected = Number(recentQC._sum.inspectedQty || 0);
  const passed = Number(recentQC._sum.passedQty || 0);

  return ok(res, {
    activeOrders,
    completedOrders,
    delayedOrders,
    pendingMaintenance,
    overallPassRatePct: inspected > 0 ? ((passed / inspected) * 100).toFixed(1) : "N/A",
  }, "Manufacturing dashboard loaded");
}));

export default router;
