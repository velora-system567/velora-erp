import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPrisma } from "../../config/db.js";
import { PERMISSIONS } from "../../utils/permissions.js";

const router = Router();
router.use(requireAuth, requireTenant);

// ─── HR Dashboard ────────────────────────────────────────────────
router.get("/hrms/dashboard", requirePermission(PERMISSIONS.DASHBOARD_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;

  const [totalEmployees, activeUsers, roles, recentUsers] = await Promise.all([
    prisma.user.count({ where: { tenantId, companyId, isDeleted: false } }),
    prisma.user.count({ where: { tenantId, companyId, isDeleted: false, isActive: true } }),
    prisma.role.findMany({ where: { tenantId, companyId, isDeleted: false }, include: { _count: { select: { userRoles: true } } } }),
    prisma.user.findMany({ where: { tenantId, companyId, isDeleted: false }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, name: true, email: true, isActive: true, createdAt: true, userRoles: { include: { role: { select: { name: true } } } } } }),
  ]);

  const departmentStats = roles.map((r) => ({ name: r.name, count: r._count.userRoles }));

  return ok(res, {
    kpis: { totalEmployees, activeUsers, inactiveUsers: totalEmployees - activeUsers, departments: roles.length },
    departments: departmentStats,
    recentEmployees: recentUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive, role: u.userRoles?.[0]?.role?.name || "—", joinedAt: u.createdAt })),
  }, "HR dashboard loaded");
}));

// ─── Employee List ───────────────────────────────────────────────
router.get("/hrms/employees", requirePermission(PERMISSIONS.USER_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const { tenantId, companyId } = req;
  const { page = 1, limit = 50, department } = req.query;

  const where = { tenantId, companyId, isDeleted: false };
  if (department) where.userRoles = { some: { role: { name: department } } };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, skip: (Number(page) - 1) * Number(limit), take: Number(limit), orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true, userRoles: { include: { role: { select: { name: true } } } } },
    }),
  ]);

  const employees = rows.map((u) => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone || "—", isActive: u.isActive,
    role: u.userRoles?.[0]?.role?.name || "—", joinedAt: u.createdAt,
  }));

  return ok(res, employees, "Employees loaded", { page: Number(page), limit: Number(limit), total });
}));

// ─── Employee Detail ─────────────────────────────────────────────
router.get("/hrms/employees/:id", requirePermission(PERMISSIONS.USER_READ),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(async (req, res) => {
    const prisma = getPrisma();
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
      include: { userRoles: { include: { role: true } }, userBranches: { include: { branch: true } } },
    });
    if (!user) { const e = new Error("Employee not found"); e.statusCode = 404; throw e; }
    const { passwordHash, ...safeUser } = user;
    return ok(res, safeUser, "Employee loaded");
  }));

// ─── Roles / Departments ─────────────────────────────────────────
router.get("/hrms/roles", requirePermission(PERMISSIONS.USER_READ), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  const roles = await prisma.role.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    include: { _count: { select: { userRoles: true } } },
    orderBy: { name: "asc" },
  });
  return ok(res, roles.map((r) => ({ id: r.id, name: r.name, description: r.description, employeeCount: r._count.userRoles })), "Roles loaded");
}));

export default router;
