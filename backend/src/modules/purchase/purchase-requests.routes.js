import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../../config/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { created, ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { writeAudit } from "../../utils/audit.js";

const router = Router();
router.use(requireAuth);

// Schema for Purchase Request Item
const purchaseRequestItemSchema = z.object({
  materialName: z.string().min(2),
  category: z.string().min(2),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
  estimatedCost: z.coerce.number().min(0),
  requiredDate: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  notes: z.string().optional().or(z.literal("")),
});

// Schema for creating Purchase Request
const createPurchaseRequestSchema = z.object({
  body: z.object({
    departmentId: z.string().uuid(),
    projectId: z.string().uuid().optional().or(z.literal("")),
    requestedBy: z.string().uuid(),
    notes: z.string().optional().or(z.literal("")),
    attachments: z.array(z.string()).optional(),
    items: z.array(purchaseRequestItemSchema).min(1, "At least one item is required"),
  }),
});

// Schema for updating Purchase Request
const updatePurchaseRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: createPurchaseRequestSchema.shape.body.partial(),
});

// Generate unique request number
function generateRequestNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PR-${timestamp}-${random}`;
}

// Get all purchase requests with filters
router.get("/requests", asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { status, department, priority, search, page = 1, limit = 20 } = req.query;
  
  const where = {
    tenantId: req.tenantId,
    companyId: req.companyId,
    isDeleted: false,
  };

  if (status) where.status = status;
  if (department) where.departmentId = department;
  if (priority) where.priority = priority;
  if (search) {
    where.OR = [
      { requestNumber: { contains: search } },
      { notes: { contains: search } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [requests, total] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where,
      include: {
        items: true,
        department: { select: { name: true } },
        project: { select: { name: true, code: true } },
        requestedByUser: { select: { firstName: true, lastName: true, email: true } },
        approvedByUser: { select: { firstName: true, lastName: true, email: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.purchaseRequest.count({ where }),
  ]);

  return ok(res, { 
    data: requests, 
    pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
  }, "Purchase requests loaded");
}));

// Get single purchase request
router.get("/requests/:id", validate(z.object({ params: z.object({ id: z.string().uuid() }) })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  
  const request = await prisma.purchaseRequest.findUnique({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    include: {
      items: true,
      department: true,
      project: true,
      requestedByUser: { select: { firstName: true, lastName: true, email: true } },
      approvedByUser: { select: { firstName: true, lastName: true, email: true } },
      attachments: true,
    },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: "Purchase request not found" });
  }

  return ok(res, request, "Purchase request loaded");
}));

// Create purchase request
router.post("/requests", validate(createPurchaseRequestSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  
  const requestNumber = generateRequestNumber();

  const request = await prisma.purchaseRequest.create({
    data: {
      requestNumber,
      status: "DRAFT",
      tenantId: req.tenantId,
      companyId: req.companyId,
      branchId: req.branchId,
      departmentId: req.validated.body.departmentId,
      projectId: req.validated.body.projectId || null,
      requestedBy: req.validated.body.requestedBy,
      notes: req.validated.body.notes || null,
      attachments: req.validated.body.attachments || [],
      items: {
        create: req.validated.body.items.map(item => ({
          materialName: item.materialName,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          estimatedCost: Math.round(item.estimatedCost * 100), // Store in paise
          requiredDate: new Date(item.requiredDate),
          priority: item.priority,
          notes: item.notes || null,
        })),
      },
      createdBy: req.user.sub,
      updatedBy: req.user.sub,
    },
    include: { items: true },
  });

  await writeAudit(req, { 
    tableName: "purchase_requests", 
    recordId: request.id, 
    action: "PURCHASE_REQUEST_CREATED", 
    newValue: request 
  });

  return created(res, request, "Purchase request created");
}));

// Update purchase request (only DRAFT or REJECTED status)
router.patch("/requests/:id", validate(updatePurchaseRequestSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  
  const existing = await prisma.purchaseRequest.findUnique({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId },
    select: { status: true },
  });

  if (!existing) {
    return res.status(404).json({ success: false, message: "Purchase request not found" });
  }

  if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
    return res.status(400).json({ 
      success: false, 
      message: "Cannot update purchase request in current status" 
    });
  }

  const updateData = {};
  
  if (req.validated.body.departmentId) updateData.departmentId = req.validated.body.departmentId;
  if (req.validated.body.projectId !== undefined) updateData.projectId = req.validated.body.projectId || null;
  if (req.validated.body.notes !== undefined) updateData.notes = req.validated.body.notes || null;
  if (req.validated.body.attachments !== undefined) updateData.attachments = req.validated.body.attachments;
  
  if (req.validated.body.items) {
    updateData.items = {
      deleteMany: {},
      create: req.validated.body.items.map(item => ({
        materialName: item.materialName,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        estimatedCost: Math.round(item.estimatedCost * 100),
        requiredDate: new Date(item.requiredDate),
        priority: item.priority,
        notes: item.notes || null,
      })),
    };
  }

  updateData.updatedBy = req.user.sub;

  const request = await prisma.purchaseRequest.update({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId },
    data: updateData,
    include: { items: true },
  });

  await writeAudit(req, { 
    tableName: "purchase_requests", 
    recordId: request.id, 
    action: "PURCHASE_REQUEST_UPDATED", 
    oldValue: existing, 
    newValue: request 
  });

  return ok(res, request, "Purchase request updated");
}));

// Delete purchase request (soft delete)
router.delete("/requests/:id", validate(z.object({ params: z.object({ id: z.string().uuid() }) })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  
  const request = await prisma.purchaseRequest.findUnique({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId },
    select: { status: true },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: "Purchase request not found" });
  }

  if (request.status === "ORDERED" || request.status === "DELIVERED") {
    return res.status(400).json({ 
      success: false, 
      message: "Cannot delete purchase request that has been ordered or delivered" 
    });
  }

  const deleted = await prisma.purchaseRequest.update({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId },
    data: { isDeleted: true, status: "CANCELLED", updatedBy: req.user.sub },
  });

  await writeAudit(req, { 
    tableName: "purchase_requests", 
    recordId: deleted.id, 
    action: "PURCHASE_REQUEST_DELETED", 
    newValue: deleted 
  });

  return ok(res, deleted, "Purchase request deleted");
}));

// Submit for approval
router.post("/requests/:id/submit", validate(z.object({ params: z.object({ id: z.string().uuid() }) })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  
  const request = await prisma.purchaseRequest.findUnique({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId },
    select: { status: true, items: true },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: "Purchase request not found" });
  }

  if (request.status !== "DRAFT") {
    return res.status(400).json({ 
      success: false, 
      message: "Only draft requests can be submitted for approval" 
    });
  }

  if (request.items.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: "Cannot submit empty purchase request" 
    });
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId },
    data: { status: "PENDING", updatedBy: req.user.sub },
    include: { items: true },
  });

  await writeAudit(req, { 
    tableName: "purchase_requests", 
    recordId: updated.id, 
    action: "PURCHASE_REQUEST_SUBMITTED", 
    newValue: updated 
  });

  return ok(res, updated, "Submitted for approval");
}));

// Approve/Reject request
router.patch("/requests/:id/status", validate(z.object({ 
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ 
    status: z.enum(["APPROVED", "REJECTED"]),
    remarks: z.string().optional().or(z.literal("")),
  }),
})), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { status, remarks } = req.validated.body;

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: "Purchase request not found" });
  }

  if (request.status !== "PENDING") {
    return res.status(400).json({ 
      success: false, 
      message: "Only pending requests can be approved or rejected" 
    });
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId },
    data: { 
      status, 
      approvedBy: req.user.sub,
      approvedAt: new Date(),
      remarks: remarks || null,
      updatedBy: req.user.sub,
    },
    include: { items: true },
  });

  await writeAudit(req, { 
    tableName: "purchase_requests", 
    recordId: updated.id, 
    action: `PURCHASE_REQUEST_${status}`, 
    newValue: updated 
  });

  return ok(res, updated, `Purchase request ${status.toLowerCase()} successfully`);
}));

export default router;
