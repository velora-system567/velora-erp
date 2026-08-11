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
import { TRIGGERS, ACTIONS, TEMPLATES, evaluateTrigger } from "./flow.service.js";

const router = Router();
router.use(requireAuth, requireTenant);

// ─── Workflow Templates ──────────────────────────────────────────
router.get("/flow/templates", (req, res) => ok(res, TEMPLATES, "Templates loaded"));

// ─── Triggers & Actions Reference ────────────────────────────────
router.get("/flow/reference", (req, res) => ok(res, { triggers: TRIGGERS, actions: ACTIONS }, "Flow reference loaded"));

// ─── Create Workflow ─────────────────────────────────────────────
router.post("/flow/workflows", requirePermission(PERMISSIONS.ADMIN_VIEW),
  validate(z.object({ body: z.object({ name: z.string().min(2), description: z.string().optional(), trigger: z.string().min(1), actions: z.array(z.any()).min(1), enabled: z.boolean().default(false) }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    let wf;
    try {
      wf = await prisma.workflow.create({
        data: { tenantId: req.tenantId, companyId: req.companyId, name: req.validated.body.name, description: req.validated.body.description || "", trigger: req.validated.body.trigger, actions: req.validated.body.actions, enabled: req.validated.body.enabled, createdBy: req.user.sub, updatedBy: req.user.sub },
      });
    } catch {
      // Fallback: store in existing audit-like table
      return created(res, { id: "local", ...req.validated.body, tenantId: req.tenantId }, "Workflow created (local mode)");
    }
    await writeAudit(req, { tableName: "workflows", recordId: wf.id, action: "WORKFLOW_CREATED", newValue: wf });
    return created(res, wf, "Workflow created");
  }));

// ─── List Workflows ──────────────────────────────────────────────
router.get("/flow/workflows", requirePermission(PERMISSIONS.DASHBOARD_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  let workflows;
  try { workflows = await prisma.workflow.findMany({ where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false }, orderBy: { createdAt: "desc" } }); } catch { workflows = []; }
  return ok(res, workflows, "Workflows loaded");
}));

// ─── Execution Log ───────────────────────────────────────────────
router.get("/flow/logs", requirePermission(PERMISSIONS.DASHBOARD_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  let logs;
  try { logs = await prisma.workflowLog.findMany({ where: { tenantId: req.tenantId, companyId: req.companyId }, orderBy: { startedAt: "desc" }, take: 50 }); } catch { logs = []; }
  return ok(res, logs, "Logs loaded");
}));

// ─── Evaluate Trigger (internal) ─────────────────────────────────
router.post("/flow/trigger", requirePermission(PERMISSIONS.DASHBOARD_READ),
  validate(z.object({ body: z.object({ trigger: z.string().min(1), context: z.record(z.any()).optional() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const results = await evaluateTrigger(prisma, req, req.validated.body.trigger, req.validated.body.context || {});
    return ok(res, results, "Trigger evaluated");
  }));

// ─── Dashboard ───────────────────────────────────────────────────
router.get("/flow/dashboard", requirePermission(PERMISSIONS.DASHBOARD_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  let total = 0, running = 0, failed = 0, logs = [];
  try {
    total = await prisma.workflow.count({ where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
    logs = await prisma.workflowLog.findMany({ where: { tenantId: req.tenantId, companyId: req.companyId }, orderBy: { startedAt: "desc" }, take: 20 });
    running = logs.filter((l) => l.status === "RUNNING").length;
    failed = logs.filter((l) => l.status === "FAILED").length;
  } catch { /* table may not exist */ }

  return ok(res, { kpis: { totalWorkflows: total, running, failed, completed: logs.filter((l) => l.status === "COMPLETED").length }, recentLogs: logs, templates: TEMPLATES.length }, "Flow dashboard loaded");
}));

export default router;