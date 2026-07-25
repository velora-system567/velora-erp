import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate, sanitizeUuid } from "../../middleware/validate.js";
import { getPrisma } from "../../config/db.js";
import { created, ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { gstinRegex, panRegex } from "../../utils/validators.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import { updateTenantRecord } from "../../utils/tenant-record.js";

const router = Router();
const prismaModelByResource = {
  users: "user",
  roles: "role",
  items: "item",
  "item-categories": "itemCategory",
  "units-of-measure": "unitOfMeasure",
  customers: "customer",
  vendors: "vendor",
  "chart-of-accounts": "chartOfAccount",
  "tax-rates": "taxRate",
  warehouses: "warehouse",
  "price-lists": "priceList",
};

const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).default(20).transform(v => Math.min(v, 500)),
    q: z.string().optional(),
  }),
  params: z.object({ resource: z.string() }),
});

const idSchema = z.object({
  params: z.object({ resource: z.string(), id: z.preprocess(sanitizeUuid, z.string().uuid()) }),
});

const writeSchema = z.object({
  params: z.object({ resource: z.string() }),
  body: z.record(z.string(), z.unknown()),
});

const itemSearchSchema = z.object({
  query: z.object({ q: z.string().default("") }),
});

const customerVendorSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    gstin: z.string().regex(gstinRegex).optional(),
    panNumber: z.string().regex(panRegex).optional(),
    billingAddress: z.unknown().optional(),
    shippingAddress: z.unknown().optional(),
    creditLimit: z.number().int().default(0),
    creditDays: z.number().int().default(0),
    paymentTerms: z.string().optional(),
    openingBalance: z.number().int().default(0),
  }),
});

function modelFor(resource) {
  const model = prismaModelByResource[resource];
  if (!model) {
    const error = new Error(`Unsupported resource: ${resource}`);
    error.statusCode = 404;
    throw error;
  }
  return model;
}

router.use(requireAuth, requireTenant);

router.get("/items/search", requirePermission(PERMISSIONS.MASTER_READ), validate(itemSearchSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const rows = await prisma.item.findMany({
    where: {
      tenantId: req.tenantId,
      companyId: req.companyId,
      isDeleted: false,
      OR: [
        { name: { contains: req.validated.query.q, mode: "insensitive" } },
        { itemCode: { contains: req.validated.query.q, mode: "insensitive" } },
        { barcode: { contains: req.validated.query.q, mode: "insensitive" } },
        { qrCode: { contains: req.validated.query.q, mode: "insensitive" } },
        { brand: { contains: req.validated.query.q, mode: "insensitive" } },
      ],
    },
    take: 20,
  });
  return ok(res, rows, "Items found");
}));

router.get("/customers/:id/outstanding", requirePermission(PERMISSIONS.SALES_READ), validate(z.object({ params: z.object({ id: z.preprocess(sanitizeUuid, z.string().uuid()) }) })), asyncHandler(async (req, res) => {
  return ok(res, { customerId: req.params.id, outstandingPaise: 0 }, "Customer outstanding");
}));

router.get("/:resource", requirePermission(PERMISSIONS.MASTER_READ), validate(listSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const model = modelFor(req.validated.params.resource);
  const { page, limit } = req.validated.query;
  const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false };
  const [total, rows] = await Promise.all([
    prisma[model].count({ where }),
    prisma[model].findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
  ]);
  return ok(res, rows, "Records loaded", { page, limit, total });
}));

router.post("/:resource", requirePermission(PERMISSIONS.MASTER_CREATE), validate(writeSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const model = modelFor(req.validated.params.resource);
  if (["customers", "vendors"].includes(req.validated.params.resource)) {
    customerVendorSchema.parse({ body: req.validated.body });
  }
  const row = await prisma[model].create({
    data: {
      ...req.validated.body,
      tenantId: req.tenantId,
      companyId: req.companyId,
      branchId: req.branchId,
      createdBy: req.user.sub,
      updatedBy: req.user.sub,
    },
  });
  return created(res, row, "Record created");
}));

router.get("/:resource/:id", requirePermission(PERMISSIONS.MASTER_READ), validate(idSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const model = modelFor(req.validated.params.resource);
  const row = await prisma[model].findFirst({
    where: { id: req.validated.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
  });
  if (!row) {
    const error = new Error(`${req.validated.params.resource} not found`);
    error.statusCode = 404;
    throw error;
  }
  return ok(res, row, "Record loaded");
}));

router.patch("/:resource/:id", requirePermission(PERMISSIONS.MASTER_UPDATE), validate(z.object({ params: idSchema.shape.params, body: z.record(z.string(), z.unknown()) })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const model = modelFor(req.validated.params.resource);
  const row = await updateTenantRecord(prisma, model, req, req.validated.params.id,
    { ...req.validated.body, updatedBy: req.user.sub });
  return ok(res, row, "Record updated");
}));

router.delete("/:resource/:id", requirePermission(PERMISSIONS.MASTER_DELETE), validate(idSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const model = modelFor(req.validated.params.resource);
  const row = await updateTenantRecord(prisma, model, req, req.validated.params.id,
    { isDeleted: true, updatedBy: req.user.sub });
  return ok(res, row, "Record deleted");
}));

router.post("/items/bulk-import", asyncHandler(async (req, res) => {
  return ok(res, { queued: true }, "Item import queued");
}));

export default router;
