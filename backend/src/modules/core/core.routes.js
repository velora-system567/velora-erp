import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../../config/db.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate, sanitizeUuid } from "../../middleware/validate.js";
import { created, ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { writeAudit } from "../../utils/audit.js";
import { panRegex } from "../../utils/validators.js";
import { updateTenantRecord } from "../../utils/tenant-record.js";
import { cachedCompute } from "../../utils/single-flight-cache.js";

const router = Router();
router.use(requireAuth, requireTenant);

// FIX: Use sanitizeUuid preprocessor to reject sentinel values like
// "new", "create", "temp", "0", "" BEFORE they reach z.string().uuid().
// The validate() middleware sanitizes params/query, but body fields
// still need explicit sanitization via z.preprocess.
const idParams = z.object({ id: z.preprocess(sanitizeUuid, z.string().uuid()) });
const listQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).default(20).transform(v => Math.min(v, 500)),
  q: z.string().optional(),
});

const addressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
}).optional();

const companySchema = z.object({
  body: z.object({
    name: z.string().min(2),
    legalName: z.string().min(2),
    gstin: z.string().trim().min(1).max(32).optional().or(z.literal("")),
    panNumber: z.string().regex(panRegex).optional().or(z.literal("")),
    address: addressSchema,
  }),
});

const branchSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    code: z.string().min(1).max(20).optional().or(z.literal("")),
    address: addressSchema,
    isActive: z.boolean().default(true),
  }),
});

const userSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional().or(z.literal("")),
    password: z.string().min(8).optional(),
    role: z.enum(["OWNER", "ADMIN", "ACCOUNTANT", "SALES_MANAGER", "SALESMAN", "STORE_KEEPER", "PURCHASE_MANAGER", "PRODUCTION_OPERATOR", "HR_MANAGER"]).default("ADMIN"),
    branchIds: z.array(z.preprocess(sanitizeUuid, z.string().uuid())).default([]),
    isActive: z.boolean().default(true),
  }),
});

const resetPasswordSchema = z.object({ body: z.object({ password: z.string().min(8) }) });

const productSchema = z.object({
  body: z.object({
    itemCode: z.string().min(1).max(40),
    name: z.string().min(2),
    description: z.string().optional().or(z.literal("")),
    itemType: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "SEMI_FINISHED", "SERVICE", "CONSUMABLE"]).default("FINISHED_GOOD"),
    hsnCode: z.string().optional().or(z.literal("")),
    gstRate: z.coerce.number().int().min(0).max(28).default(18),
    purchasePrice: z.coerce.number().int().min(0).default(0),
    sellingPrice: z.coerce.number().int().min(0).default(0),
    barcode: z.string().max(120).optional().or(z.literal("")),
    qrCode: z.string().max(500).optional().or(z.literal("")),
    brand: z.string().max(120).optional().or(z.literal("")),
    imageUrl: z.string().url().optional().or(z.literal("")),
    notes: z.string().max(5000).optional().or(z.literal("")),
    trackingMode: z.enum(["NONE", "BATCH", "SERIAL", "BATCH_AND_SERIAL"]).default("NONE"),
    lifecycleStatus: z.enum(["DRAFT", "ACTIVE", "DISCONTINUED", "OBSOLETE"]).default("ACTIVE"),
    safetyStock: z.coerce.number().min(0).optional(),
    eoqQuantity: z.coerce.number().min(0).optional(),
    leadTimeDays: z.coerce.number().int().min(0).max(3650).default(0),
    isActive: z.boolean().default(true),
  }),
});

function cleanStrings(input) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value === "" ? null : value]));
}

async function listRows(model, req, extraWhere = {}) {
  const prisma = getPrisma();
  const { page, limit, q } = req.validated.query;
  const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false, ...extraWhere };
  if (q) {
    where.OR = model === "item"
      ? [
        { name: { contains: q, mode: "insensitive" } },
        { itemCode: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q, mode: "insensitive" } },
        { qrCode: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
      ]
      : [{ name: { contains: q, mode: "insensitive" } }];
  }
  // Short single-flight cache for master/reference lists (users, branches,
  // items). These are read repeatedly by every module's master-data bundle and
  // are low-churn reference data — a 20s cache collapses cold-load stampedes
  // without risking stale transactional data.
  const extraKey = q ? `:q=${q}` : "";
  const key = `tenant:${req.tenantId}:company:${req.companyId}:core:${model}:${page}:${limit}${extraKey}`;
  return cachedCompute(key, 20, async () => {
    const [total, rows] = await Promise.all([
      prisma[model].count({ where }),
      prisma[model].findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    ]);
    return { rows, meta: { page, limit, total } };
  });
}

router.get("/company", requirePermission("company:view"), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const company = await prisma.company.findFirst({
    where: { id: req.companyId, tenantId: req.tenantId, isDeleted: false },
  });
  return ok(res, company, "Company loaded");
}));

router.patch("/company", requirePermission("company:edit"), validate(companySchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const oldValue = await prisma.company.findFirst({ where: { id: req.companyId, tenantId: req.tenantId, isDeleted: false } });
  const company = await updateTenantRecord(prisma, "company", req, req.companyId,
    { ...cleanStrings(req.validated.body), updatedBy: req.user.sub }, { notFoundMessage: "Company not found" });
  await writeAudit(req, { tableName: "companies", recordId: company.id, action: "COMPANY_UPDATED", oldValue, newValue: company });
  return ok(res, company, "Company updated");
}));

router.delete("/company", requirePermission("company:delete"), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const oldValue = await prisma.company.findFirst({ where: { id: req.companyId, tenantId: req.tenantId, isDeleted: false } });
  const company = await updateTenantRecord(prisma, "company", req, req.companyId,
    { isDeleted: true, updatedBy: req.user.sub }, { notFoundMessage: "Company not found" });
  await writeAudit(req, { tableName: "companies", recordId: company.id, action: "COMPANY_ARCHIVED", oldValue, newValue: company });
  return ok(res, company, "Company archived");
}));

router.get("/branches", requirePermission("branches:view"), validate(z.object({ query: listQuery })), asyncHandler(async (req, res) => {
  const { rows, meta } = await listRows("branch", req);
  return ok(res, rows, "Branches loaded", meta);
}));

router.post("/branches", requirePermission("branches:create"), validate(branchSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const branch = await prisma.branch.create({
    data: { ...cleanStrings(req.validated.body), tenantId: req.tenantId, companyId: req.companyId, createdBy: req.user.sub, updatedBy: req.user.sub },
  });
  await writeAudit(req, { tableName: "branches", recordId: branch.id, action: "BRANCH_CREATED", newValue: branch });
  return created(res, branch, "Branch created");
}));

router.patch("/branches/:id", requirePermission("branches:edit"), validate(z.object({ params: idParams, body: branchSchema.shape.body })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const oldValue = await prisma.branch.findFirst({ where: { id: req.validated.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
  const branch = await updateTenantRecord(prisma, "branch", req, req.validated.params.id,
    { ...cleanStrings(req.validated.body), updatedBy: req.user.sub }, { notFoundMessage: "Branch not found" });
  await writeAudit(req, { tableName: "branches", recordId: branch.id, action: "BRANCH_UPDATED", oldValue, newValue: branch });
  return ok(res, branch, "Branch updated");
}));

router.delete("/branches/:id", requirePermission("branches:delete"), validate(z.object({ params: idParams })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const oldValue = await prisma.branch.findFirst({ where: { id: req.validated.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
  const branch = await updateTenantRecord(prisma, "branch", req, req.validated.params.id,
    { isDeleted: true, updatedBy: req.user.sub }, { notFoundMessage: "Branch not found" });
  await writeAudit(req, { tableName: "branches", recordId: branch.id, action: "BRANCH_DELETED", oldValue, newValue: branch });
  return ok(res, branch, "Branch deleted");
}));

router.get("/users", requirePermission("users:view"), validate(z.object({ query: listQuery })), asyncHandler(async (req, res) => {
  const { rows, meta } = await listRows("user", req);
  return ok(res, rows.map(({ passwordHash, ...row }) => row), "Users loaded", meta);
}));

router.post("/users", requirePermission("users:create"), validate(userSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const passwordHash = await bcrypt.hash(req.validated.body.password || crypto.randomUUID(), 12);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        tenantId: req.tenantId,
        companyId: req.companyId,
        name: req.validated.body.name,
        email: req.validated.body.email.toLowerCase(),
        phone: req.validated.body.phone || null,
        passwordHash,
        isActive: req.validated.body.isActive,
        createdBy: req.user.sub,
        updatedBy: req.user.sub,
      },
    });
    const role = await tx.role.upsert({
      where: { tenantId_companyId_name: { tenantId: req.tenantId, companyId: req.companyId, name: req.validated.body.role } },
      update: {},
      create: { tenantId: req.tenantId, companyId: req.companyId, name: req.validated.body.role, createdBy: req.user.sub, updatedBy: req.user.sub },
    });
    await tx.userRole.create({ data: { tenantId: req.tenantId, companyId: req.companyId, userId: user.id, roleId: role.id, createdBy: req.user.sub, updatedBy: req.user.sub } });
    for (const branchId of req.validated.body.branchIds) {
      await tx.userBranch.create({ data: { tenantId: req.tenantId, companyId: req.companyId, userId: user.id, branchId, createdBy: req.user.sub, updatedBy: req.user.sub } });
    }
    await writeAudit(req, { tx, tableName: "users", recordId: user.id, action: "USER_CREATED", newValue: { ...user, passwordHash: undefined } });
    return user;
  });
  const { passwordHash: _passwordHash, ...user } = result;
  return created(res, user, "User created");
}));

router.patch("/users/:id", requirePermission("users:edit"), validate(z.object({ params: idParams, body: userSchema.shape.body.partial() })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const oldValue = await prisma.user.findFirst({ where: { id: req.validated.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
  const data = cleanStrings(req.validated.body);
  delete data.password;
  delete data.branchIds;
  delete data.role;
  if (data.email) data.email = data.email.toLowerCase();
  const updated = await updateTenantRecord(prisma, "user", req, req.validated.params.id,
    { ...data, updatedBy: req.user.sub }, { notFoundMessage: "User not found" });
  await writeAudit(req, { tableName: "users", recordId: updated.id, action: "USER_UPDATED", oldValue, newValue: { ...updated, passwordHash: undefined } });
  const { passwordHash: _passwordHash, ...user } = updated;
  return ok(res, user, "User updated");
}));

router.post("/users/:id/reset-password", requirePermission("users:edit"), validate(z.object({ params: idParams, body: resetPasswordSchema.shape.body })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const passwordHash = await bcrypt.hash(req.validated.body.password, 12);
  const user = await updateTenantRecord(prisma, "user", req, req.validated.params.id,
    { passwordHash, updatedBy: req.user.sub }, { notFoundMessage: "User not found" });
  await writeAudit(req, { tableName: "users", recordId: user.id, action: "USER_PASSWORD_RESET", newValue: { userId: user.id } });
  return ok(res, {}, "Password reset");
}));

router.post("/users/:id/disable", requirePermission("users:edit"), validate(z.object({ params: idParams })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const user = await updateTenantRecord(prisma, "user", req, req.validated.params.id,
    { isActive: false, updatedBy: req.user.sub }, { notFoundMessage: "User not found" });
  await writeAudit(req, { tableName: "users", recordId: user.id, action: "USER_DISABLED", newValue: { userId: user.id } });
  return ok(res, {}, "User disabled");
}));

router.delete("/users/:id", requirePermission("users:delete"), validate(z.object({ params: idParams })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const user = await updateTenantRecord(prisma, "user", req, req.validated.params.id,
    { isDeleted: true, updatedBy: req.user.sub }, { notFoundMessage: "User not found" });
  await writeAudit(req, { tableName: "users", recordId: user.id, action: "USER_DELETED", newValue: { userId: user.id } });
  return ok(res, {}, "User deleted");
}));

router.get("/products", requirePermission("products:view"), validate(z.object({ query: listQuery })), asyncHandler(async (req, res) => {
  const { rows, meta } = await listRows("item", req);
  return ok(res, rows, "Products loaded", meta);
}));

router.post("/products", requirePermission("products:create"), validate(productSchema), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const product = await prisma.item.create({
    data: { ...cleanStrings(req.validated.body), tenantId: req.tenantId, companyId: req.companyId, createdBy: req.user.sub, updatedBy: req.user.sub },
  });
  await writeAudit(req, { tableName: "items", recordId: product.id, action: "PRODUCT_CREATED", newValue: product });
  return created(res, product, "Product created");
}));

router.patch("/products/:id", requirePermission("products:edit"), validate(z.object({ params: idParams, body: productSchema.shape.body })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const oldValue = await prisma.item.findFirst({ where: { id: req.validated.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
  const product = await updateTenantRecord(prisma, "item", req, req.validated.params.id,
    { ...cleanStrings(req.validated.body), updatedBy: req.user.sub }, { notFoundMessage: "Product not found" });
  await writeAudit(req, { tableName: "items", recordId: product.id, action: "PRODUCT_UPDATED", oldValue, newValue: product });
  return ok(res, product, "Product updated");
}));

router.delete("/products/:id", requirePermission("products:delete"), validate(z.object({ params: idParams })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const oldValue = await prisma.item.findFirst({ where: { id: req.validated.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false } });
  const product = await updateTenantRecord(prisma, "item", req, req.validated.params.id,
    { isDeleted: true, updatedBy: req.user.sub }, { notFoundMessage: "Product not found" });
  await writeAudit(req, { tableName: "items", recordId: product.id, action: "PRODUCT_DELETED", oldValue, newValue: product });
  return ok(res, product, "Product deleted");
}));

router.get("/audit-logs", requirePermission("audit:view"), validate(z.object({ query: listQuery.extend({ module: z.string().optional() }) })), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { page, limit, module } = req.validated.query;
  const where = { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false, ...(module ? { tableName: module } : {}) };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
  ]);
  return ok(res, rows, "Audit logs loaded", { page, limit, total });
}));

export default router;
