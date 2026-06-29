import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../../config/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { created, ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { writeAudit } from "../../utils/audit.js";
import { createOperationRecord, deleteOperationRecord, listOperationRecords, operationSchema } from "../../utils/operation-records.js";

const router = Router();
router.use(requireAuth);

const leadSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    contactPerson: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    email: z.string().email().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    source: z.string().optional().or(z.literal("")),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
    status: z.enum(["NEW", "QUALIFIED", "LOST", "CONVERTED"]).default("NEW"),
    value: z.coerce.number().min(0).default(0),
    notes: z.string().optional().or(z.literal("")),
    requirement: z.string().optional().or(z.literal("")),
    nextFollowUp: z.string().optional().or(z.literal("")),
  }),
});

function cleanLead(input) {
  return {
    name: input.name,
    contactPerson: input.contactPerson || null,
    phone: input.phone || null,
    email: input.email || null,
    city: input.city || null,
    source: input.source || null,
    priority: input.priority,
    status: input.status,
    value: Math.round(Number(input.value) * 100),
    notes: input.notes || null,
    requirement: input.requirement || null,
    nextFollowUp: input.nextFollowUp ? new Date(input.nextFollowUp) : null,
  };
}

router.get("/leads", asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const rows = await prisma.lead.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    orderBy: [{ nextFollowUp: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return ok(res, rows, "Leads loaded");
}));

router.post("/leads", validate(leadSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const lead = await prisma.lead.create({
    data: {
      ...cleanLead(req.validated.body),
      tenantId: req.tenantId,
      companyId: req.companyId,
      branchId: req.branchId,
      createdBy: req.user.sub,
      updatedBy: req.user.sub,
    },
  });
  await writeAudit(req, { tableName: "leads", recordId: lead.id, action: "LEAD_CREATED", newValue: lead });
  return created(res, lead, "Lead created");
}));

router.patch("/leads/:id", validate(z.object({ params: z.object({ id: z.string().uuid() }), body: leadSchema.shape.body.partial() })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const oldValue = await prisma.lead.findFirst({ where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
  const data = cleanLead({ ...oldValue, ...req.validated.body, value: req.validated.body.value ?? (oldValue?.value || 0) / 100 });
  const lead = await prisma.lead.update({ where: { id: req.params.id }, data: { ...data, updatedBy: req.user.sub } });
  await writeAudit(req, { tableName: "leads", recordId: lead.id, action: "LEAD_UPDATED", oldValue, newValue: lead });
  return ok(res, lead, "Lead updated");
}));

router.delete("/leads/:id", validate(z.object({ params: z.object({ id: z.string().uuid() }) })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const lead = await prisma.lead.update({ where: { id: req.params.id }, data: { isDeleted: true, updatedBy: req.user.sub } });
  await writeAudit(req, { tableName: "leads", recordId: lead.id, action: "LEAD_DELETED", newValue: lead });
  return ok(res, lead, "Lead deleted");
}));

router.get("/sales/records", listOperationRecords("SALES"));
router.post("/sales/records", validate(operationSchema), createOperationRecord("SALES"));
router.delete("/sales/records/:id", deleteOperationRecord("SALES"));
router.get("/sales/outstanding-report", (req, res) => ok(res, { rows: [] }, "Outstanding report"));
router.get("/sales/collection-report", (req, res) => ok(res, { rows: [] }, "Collection report"));
router.get("/customers/:id/ledger", (req, res) => ok(res, { rows: [] }, "Customer ledger"));
router.post("/quotations/:id/convert-to-order", (req, res) => ok(res, {}, "Quotation conversion queued"));
router.post("/sales-orders/:id/create-delivery-challan", (req, res) => ok(res, {}, "Delivery challan creation queued"));
router.post("/invoices/:id/record-payment", (req, res) => ok(res, {}, "Payment recording queued"));

export default router;
