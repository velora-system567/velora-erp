/**
 * Velora Flow — Workflow Execution Engine
 *
 * Processes workflow definitions and executes actions when triggers fire.
 * Workflows are stored as JSON definitions with trigger + action blocks.
 */

import { getPrisma } from "../../config/db.js";

const TRIGGERS = {
  sales_order_created: "When a sales order is created",
  invoice_generated: "When an invoice is generated",
  payment_received: "When a payment is received",
  lead_created: "When a new lead is added",
  lead_won: "When a lead is marked as Won",
  purchase_approved: "When a purchase order is approved",
  stock_low: "When stock is below reorder level",
  employee_joined: "When a new employee is added",
  leave_approved: "When a leave request is approved",
  production_completed: "When a production order completes",
  maintenance_due: "When asset maintenance is due",
  scheduled: "At a scheduled time",
  manual: "When triggered manually",
};

const ACTIONS = {
  send_email: "Send Email",
  create_notification: "Create In-App Notification",
  create_task: "Create Task",
  update_record: "Update Record",
  create_record: "Create Record",
  delay: "Wait / Delay",
  webhook: "Call Webhook",
  approval: "Send for Approval",
};

const TEMPLATES = [
  {
    name: "Invoice Overdue Reminder",
    description: "Send reminder when invoice is overdue by 7 days",
    trigger: "invoice_generated",
    actions: [{ type: "send_email", config: { subject: "Payment Reminder", template: "Your invoice {{ref}} is overdue." } }, { type: "create_notification", config: { title: "Overdue Invoice", message: "Follow up on invoice {{ref}}" } }, { type: "delay", config: { duration: 7, unit: "days" } }, { type: "send_email", config: { subject: "Final Reminder", template: "Final reminder for invoice {{ref}}" } }],
    enabled: false,
  },
  {
    name: "New Lead Assignment",
    description: "Notify sales team when a high-value lead comes in",
    trigger: "lead_created",
    actions: [{ type: "create_notification", config: { title: "New Lead", message: "Lead {{name}} created with value {{value}}" } }, { type: "create_task", config: { title: "Follow up with {{name}}", priority: "HIGH" } }],
    enabled: false,
  },
  {
    name: "Low Stock Alert",
    description: "Alert when inventory drops below reorder level",
    trigger: "stock_low",
    actions: [{ type: "create_notification", config: { title: "Low Stock Alert", message: "Item {{item}} is running low" } }, { type: "create_record", config: { module: "purchase_request", data: { notes: "Auto-generated PR for {{item}}" } } }],
    enabled: false,
  },
  {
    name: "Payment Received Notification",
    description: "Notify finance when a payment is received",
    trigger: "payment_received",
    actions: [{ type: "create_notification", config: { title: "Payment Received", message: "Payment of {{amount}} received" } }],
    enabled: false,
  },
  {
    name: "Purchase Order Approval",
    description: "Multi-level approval for purchase orders over ₹50,000",
    trigger: "purchase_approved",
    actions: [{ type: "approval", config: { title: "PO Approval Required", message: "Purchase order {{ref}} needs approval" } }, { type: "create_notification", config: { title: "PO Approved", message: "Purchase order {{ref}} has been approved" } }],
    enabled: false,
  },
];

export { TRIGGERS, ACTIONS, TEMPLATES };

/**
 * Evaluate trigger conditions and execute matching workflows.
 */
export async function evaluateTrigger(prisma, { tenantId, companyId }, trigger, context = {}) {
  const workflows = await prisma.workflow.findMany({
    where: { tenantId, companyId, trigger, enabled: true, isDeleted: false },
  });

  const results = [];
  for (const wf of workflows) {
    try {
      const log = await prisma.workflowLog.create({
        data: { tenantId, companyId, workflowId: wf.id, trigger, context: context || {}, status: "RUNNING", startedAt: new Date() },
      });
      await executeActions(prisma, { tenantId, companyId }, wf.actions, context);
      await prisma.workflowLog.update({ where: { id: log.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      results.push({ workflowId: wf.id, status: "COMPLETED" });
    } catch (error) {
      console.error(`[flow] Workflow ${wf.id} failed:`, error.message);
      results.push({ workflowId: wf.id, status: "FAILED", error: error.message });
    }
  }
  return results;
}

async function executeActions(prisma, tenant, actions, context) {
  for (const action of actions) {
    const template = (str) => str?.replace(/{{(\w+)}}/g, (_, key) => context[key] || `{{${key}}}`) || "";
    switch (action.type) {
      case "create_notification":
        await prisma.notification?.create?.({
          data: { tenantId: tenant.tenantId, title: template(action.config?.title), message: template(action.config?.message), type: "INFO" },
        }).catch(() => {});
        break;
      case "delay":
        if (action.config?.duration) {
          await new Promise((resolve) => setTimeout(resolve, action.config.duration * (action.config.unit === "hours" ? 3600000 : action.config.unit === "minutes" ? 60000 : 86400000)));
        }
        break;
      default:
        break;
    }
  }
}