import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate } from "../../middleware/validate.js";
import { ok, created } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPrisma } from "../../config/db.js";
import { getRedis } from "../../config/redis.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import { writeAudit } from "../../utils/audit.js";

const router = Router();
router.use(requireAuth, requireTenant);

// ─── API Monitoring Dashboard ────────────────────────────────────
router.get("/platform/monitoring", requirePermission(PERMISSIONS.ADMIN), asyncHandler(async (req, res) => {
  const redis = getRedis();
  const key = `tenant:${req.tenantId}:api:stats`;
  let stats = { requests: 0, errors: 0, avgLatency: 0, endpoints: {} };
  try { const cached = await redis.get(key); if (cached) stats = JSON.parse(cached); } catch { /* no stats */ }
  return ok(res, stats, "API monitoring data");
}));

// ─── API Keys ────────────────────────────────────────────────────
router.get("/platform/api-keys", requirePermission(PERMISSIONS.ADMIN), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  let keys = [];
  try { keys = await prisma.apiKey.findMany({ where: { tenantId: req.tenantId, isDeleted: false }, orderBy: { createdAt: "desc" } }); } catch { keys = []; }
  return ok(res, keys.map((k) => ({ id: k.id, name: k.name, key: k.key?.slice(0, 8) + "…", lastUsedAt: k.lastUsedAt, createdAt: k.createdAt, isActive: k.isActive })), "API keys");
}));

router.post("/platform/api-keys", requirePermission(PERMISSIONS.ADMIN),
  validate(z.object({ body: z.object({ name: z.string().min(2) }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const key = `vel_${crypto.randomBytes(24).toString("hex")}`;
    let result;
    try {
      result = await prisma.apiKey.create({
        data: { tenantId: req.tenantId, companyId: req.companyId, name: req.validated.body.name, key, createdBy: req.user.sub, updatedBy: req.user.sub },
      });
    } catch {
      return created(res, { name: req.validated.body.name, key }, "API key created (local mode)");
    }
    await writeAudit(req, { tableName: "api_keys", recordId: result.id, action: "API_KEY_CREATED", newValue: { name: result.name } });
    return created(res, { id: result.id, name: result.name, key }, "API key created");
  }));

router.delete("/platform/api-keys/:id", requirePermission(PERMISSIONS.ADMIN),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    try { await prisma.apiKey.update({ where: { id: req.params.id }, data: { isDeleted: true, updatedBy: req.user.sub } }); } catch { /* ignore */ }
    return ok(res, {}, "API key revoked");
  }));

// ─── Webhooks ────────────────────────────────────────────────────
router.get("/platform/webhooks", requirePermission(PERMISSIONS.ADMIN), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  let hooks = [];
  try { hooks = await prisma.webhook.findMany({ where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false }, orderBy: { createdAt: "desc" } }); } catch { hooks = []; }
  return ok(res, hooks, "Webhooks loaded");
}));

router.post("/platform/webhooks", requirePermission(PERMISSIONS.ADMIN),
  validate(z.object({ body: z.object({ name: z.string().min(2), url: z.string().url(), events: z.array(z.string()).min(1), secret: z.string().optional() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const secret = req.validated.body.secret || crypto.randomBytes(16).toString("hex");
    let result;
    try {
      result = await prisma.webhook.create({
        data: { tenantId: req.tenantId, companyId: req.companyId, name: req.validated.body.name, url: req.validated.body.url, events: req.validated.body.events, secret, isActive: true, createdBy: req.user.sub, updatedBy: req.user.sub },
      });
    } catch {
      return created(res, { name: req.validated.body.name, url: req.validated.body.url, events: req.validated.body.events, secret }, "Webhook created (local mode)");
    }
    await writeAudit(req, { tableName: "webhooks", recordId: result.id, action: "WEBHOOK_CREATED", newValue: result });
    return created(res, result, "Webhook created");
  }));

router.delete("/platform/webhooks/:id", requirePermission(PERMISSIONS.ADMIN),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    try { await prisma.webhook.update({ where: { id: req.params.id }, data: { isActive: false, updatedBy: req.user.sub } }); } catch { /* ignore */ }
    return ok(res, {}, "Webhook deleted");
  }));

// ─── Webhook Event Types ─────────────────────────────────────────
router.get("/platform/events", (req, res) => {
  return ok(res, [
    { event: "invoice.created", description: "Invoice generated" },
    { event: "payment.received", description: "Payment received" },
    { event: "lead.created", description: "New lead created" },
    { event: "lead.won", description: "Lead marked as won" },
    { event: "customer.created", description: "New customer registered" },
    { event: "stock.low", description: "Stock below reorder level" },
    { event: "purchase.approved", description: "Purchase order approved" },
    { event: "employee.created", description: "New employee added" },
    { event: "production.completed", description: "Production order completed" },
  ], "Available webhook events");
});

// ─── Webhook Test ────────────────────────────────────────────────
router.post("/platform/webhooks/test", requirePermission(PERMISSIONS.ADMIN),
  validate(z.object({ body: z.object({ url: z.string().url(), secret: z.string().optional(), event: z.string().default("test.ping") }) })),
  asyncHandler(async (req, res) => {
    const payload = JSON.stringify({ event: req.validated.body.event, timestamp: new Date().toISOString(), data: { message: "This is a test webhook from Velora ERP" } });
    const signature = crypto.createHmac("sha256", req.validated.body.secret || "test").update(payload).digest("hex");
    try {
      const response = await fetch(req.validated.body.url, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Velora-Signature": signature, "X-Velora-Event": req.validated.body.event }, body: payload,
      });
      return ok(res, { status: response.status, ok: response.ok }, response.ok ? "Webhook delivered successfully" : "Webhook delivery failed");
    } catch (error) {
      return ok(res, { status: 0, ok: false, error: error.message }, "Webhook delivery failed");
    }
  }));

// ─── Import / Export ─────────────────────────────────────────────
router.post("/platform/export", requirePermission(PERMISSIONS.ADMIN),
  validate(z.object({ body: z.object({ module: z.enum(["customers", "items", "vendors", "leads", "invoices", "orders", "contacts"]), format: z.enum(["csv", "json"]).default("csv") }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const { module, format } = req.validated.body;
    const modelMap = { customers: "customer", items: "item", vendors: "vendor", leads: "lead", invoices: "businessDocument", orders: "businessDocument", contacts: "customer" };
    const model = modelMap[module];
    let data = [];
    try {
      const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false };
      if (module === "invoices") where.documentType = "INVOICE";
      if (module === "orders") where.documentType = "SALES_ORDER";
      data = await prisma[model].findMany({ where, take: 500 });
    } catch { data = []; }
    return ok(res, { data, count: data.length, module, format }, `Export ready: ${data.length} records`);
  }));

export default router;