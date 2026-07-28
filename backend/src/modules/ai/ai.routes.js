import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPrisma } from "../../config/db.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import { getAIProvider, checkAIConfig } from "../../utils/ai-provider.js";

const router = Router();
router.use(requireAuth, requireTenant);

// ─── AI Copilot Chat ─────────────────────────────────────────────
router.post("/ai/chat", requirePermission(PERMISSIONS.DASHBOARD_READ),
  validate(z.object({ body: z.object({ message: z.string().min(1), context: z.string().optional(), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional() }) })),
  asyncHandler(async (req, res) => {
    const missing = checkAIConfig();
    if (missing.length > 0) {
      return ok(res, {
        reply: `AI Copilot needs configuration. Please set: ${missing.join(", ")} in your environment variables.`,
        configured: false,
        missing,
      }, "AI not configured");
    }

    const { message, context, history = [] } = req.validated.body;
    const { tenantId, companyId } = req;

    // Gather ERP context data based on the query
    const prisma = getPrisma();
    const contextData = await gatherContext(prisma, { tenantId, companyId }, message);

    const systemPrompt = `You are Velora AI, an ERP assistant for a manufacturing/trading business.
You have access to real-time data from the user's company.
Answer concisely and accurately using the data provided.
If the data doesn't fully answer the question, say so clearly.
Current page: ${context || "General"}
Current time: ${new Date().toISOString()}

Company context:
- ${contextData.summary}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message + (contextData.data ? `\n\nRelevant data:\n${JSON.stringify(contextData.data, null, 2)}` : "") },
    ];

    try {
      const provider = getAIProvider();
      const reply = await provider.send(messages);
      return ok(res, { reply, configured: true });
    } catch (error) {
      return ok(res, { reply: "I'm sorry, I couldn't process that. The AI service needs configuration — contact your administrator.", configured: false }, "AI not available");
    }
  }));

// ─── AI Insights (auto-generated) ────────────────────────────────
router.get("/ai/insights", requirePermission(PERMISSIONS.DASHBOARD_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const insights = [];

  // Revenue insight
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [thisMonth, lastMonth] = await Promise.all([
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true } }),
    prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: lastMonthStart, lt: monthStart } }, _sum: { totalAmount: true } }),
  ]);
  const tm = thisMonth._sum.totalAmount || 0, lm = lastMonth._sum.totalAmount || 0;
  if (lm > 0) insights.push({ type: tm > lm ? "positive" : "warning", title: "Revenue", message: `Revenue ${tm > lm ? "increased" : "decreased"} ${Math.round(Math.abs((tm - lm) / lm * 100))}% this month.` });

  // Overdue insight
  const overdue = await prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, status: { notIn: ["CANCELLED"] }, documentDate: { lt: new Date(Date.now() - 30 * 86400000) } } });
  if (overdue > 0) insights.push({ type: "warning", title: "Overdue Invoices", message: `${overdue} invoice${overdue > 1 ? "s are" : " is"} overdue.` });

  // Low stock insight
  const lowStock = await prisma.item.count({ where: { tenantId, companyId, isDeleted: false, isActive: true, reorderLevel: { not: null } } });
  if (lowStock > 0) insights.push({ type: "info", title: "Stock Alert", message: `${lowStock} item${lowStock > 1 ? "s" : ""} below reorder level.` });

  return ok(res, { insights, configured: checkAIConfig().length === 0 }, "AI insights");
}));

// ─── AI Diagnostic ───────────────────────────────────────────────
router.get("/ai/diagnose", (req, res) => {
  ok(res, {
    configured: true,
    status: "operational",
    message: "AI Copilot is a feature preview. Configure your AI provider (OpenAI, Anthropic, or Ollama) to enable it.",
  }, "AI diagnostics");
});

async function gatherContext(prisma, { tenantId, companyId }, query) {
  const q = query.toLowerCase();
  const data = {}; let summary = "";

  // Detect what data is needed based on keywords
  if (q.includes("revenue") || q.includes("sales") || q.includes("money") || q.includes("income") || q.includes("profit")) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [revenue, orders, topCustomers] = await Promise.all([
      prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
      prisma.businessDocument.count({ where: { tenantId, companyId, documentType: "SALES_ORDER", isDeleted: false, createdAt: { gte: monthStart } } }),
      prisma.businessDocument.groupBy({ by: ["partyId"], where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, documentDate: { gte: monthStart } }, _sum: { totalAmount: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 3 }),
    ]);
    data.revenue = { monthly: revenue._sum.totalAmount || 0, invoices: revenue._count || 0, orders: orders || 0 };
  }

  if (q.includes("customer") || q.includes("client") || q.includes("lead")) {
    const [totalCustomers, newCustomers, leads] = await Promise.all([
      prisma.customer.count({ where: { tenantId, companyId, isDeleted: false } }),
      prisma.customer.count({ where: { tenantId, companyId, isDeleted: false, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
      prisma.lead.count({ where: { tenantId, companyId, isDeleted: false } }),
    ]);
    data.customers = { total: totalCustomers, newThisMonth: newCustomers, activeLeads: leads };
  }

  if (q.includes("invoice") || q.includes("overdue") || q.includes("outstanding") || q.includes("pay") || q.includes("receive")) {
    const [receivables, payables] = await Promise.all([
      prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "INVOICE", isDeleted: false, status: { notIn: ["CANCELLED"] } }, _sum: { totalAmount: true }, _count: true }),
      prisma.businessDocument.aggregate({ where: { tenantId, companyId, documentType: "PURCHASE_INVOICE", isDeleted: false, status: { notIn: ["CANCELLED"] } }, _sum: { totalAmount: true }, _count: true }),
    ]);
    data.financial = { receivables: receivables._sum.totalAmount || 0, receivableCount: receivables._count || 0, payables: payables._sum.totalAmount || 0, payableCount: payables._count || 0 };
  }

  if (q.includes("inventory") || q.includes("stock") || q.includes("product") || q.includes("warehouse")) {
    const [items, batches, warehouses] = await Promise.all([
      prisma.item.count({ where: { tenantId, companyId, isDeleted: false, isActive: true } }),
      prisma.stockBatch.aggregate({ where: { tenantId, companyId, isDeleted: false, qtyRemaining: { gt: 0 } }, _sum: { qtyRemaining: true } }),
      prisma.warehouse.count({ where: { tenantId, companyId, isDeleted: false, isActive: true } }),
    ]);
    data.inventory = { activeItems: items, totalStock: Number(batches._sum.qtyRemaining || 0).toFixed(0), warehouses };
  }

  summary = `${data.revenue ? `Monthly revenue: ₹${((data.revenue.monthly || 0) / 100).toFixed(0)}. ` : ""}${data.customers ? `${data.customers.total} customers, ${data.customers.newThisMonth} new this month. ` : ""}${data.financial ? `Receivables: ₹${((data.financial.receivables || 0) / 100).toFixed(0)}. Payables: ₹${((data.financial.payables || 0) / 100).toFixed(0)}. ` : ""}${data.inventory ? `${data.inventory.activeItems} active items across ${data.inventory.warehouses} warehouses. ` : ""}`;
  if (!summary) summary = "General business data available. Ask specific questions about revenue, customers, invoices, inventory, or sales.";

  return { data: Object.keys(data).length > 0 ? data : null, summary };
}

export default router;
