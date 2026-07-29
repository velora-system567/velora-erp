/**
 * Admin Routes — Role, Permission, and User Management
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validate, sanitizeUuid } from "../../middleware/validate.js";
import { ok, created } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { requirePermission } from "../../utils/permission-engine.js";
import { getAllPermissionKeys } from "../../utils/permission-engine.js";
import {
  listRoles, getRole, createRole, updateRole, deleteRole,
  listPermissions,
  listUsers, assignUserRole, removeUserRole,
  getSystemHealth,
} from "./admin.service.js";

const router = Router();
router.use(requireAuth);

const uuid = () => z.preprocess(sanitizeUuid, z.string().uuid());

// ─── Health ─────────────────────────────────────────────────────────────────

router.get("/admin/health", requirePermission("admin:view"), asyncHandler(async (req, res) => {
  const health = await getSystemHealth(req);
  return ok(res, health, "System health");
}));

// ─── Roles ──────────────────────────────────────────────────────────────────

router.get("/admin/roles", requirePermission("admin:manageRoles"), asyncHandler(async (req, res) => {
  const roles = await listRoles(req);
  return ok(res, roles, "Roles loaded");
}));

router.get("/admin/roles/:id", requirePermission("admin:manageRoles"), asyncHandler(async (req, res) => {
  const role = await getRole(req, req.params.id);
  return ok(res, role, "Role loaded");
}));

router.post("/admin/roles", requirePermission("admin:manageRoles"),
  validate(z.object({ body: z.object({
    name: z.string().min(2, "Role name required"),
    description: z.string().optional(),
    permissionKeys: z.array(z.string()).optional(),
  }) })),
  asyncHandler(async (req, res) => {
    const role = await createRole(req, req.validated.body);
    return created(res, role, "Role created");
  }));

router.patch("/admin/roles/:id", requirePermission("admin:manageRoles"),
  validate(z.object({
    params: z.object({ id: uuid() }),
    body: z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      permissionKeys: z.array(z.string()).optional(),
    }),
  })),
  asyncHandler(async (req, res) => {
    const role = await updateRole(req, req.params.id, req.validated.body);
    return ok(res, role, "Role updated");
  }));

router.delete("/admin/roles/:id", requirePermission("admin:manageRoles"),
  validate(z.object({ params: z.object({ id: uuid() }) })),
  asyncHandler(async (req, res) => {
    const role = await deleteRole(req, req.params.id);
    return ok(res, role, "Role deleted");
  }));

// ─── Permissions ────────────────────────────────────────────────────────────

router.get("/admin/permissions", requirePermission("admin:managePermissions"), asyncHandler(async (req, res) => {
  const permissions = await listPermissions(req);
  const allKeys = getAllPermissionKeys();
  return ok(res, { dbPermissions: permissions, allKeys }, "Permissions loaded");
}));

// ─── Users (for role assignment) ────────────────────────────────────────────

router.get("/admin/users", requirePermission("admin:manageUsers"), asyncHandler(async (req, res) => {
  const users = await listUsers(req);
  return ok(res, users, "Users loaded");
}));

router.post("/admin/users/:userId/roles", requirePermission("admin:manageUsers"),
  validate(z.object({
    params: z.object({ userId: uuid() }),
    body: z.object({ roleId: uuid() }),
  })),
  asyncHandler(async (req, res) => {
    const userRole = await assignUserRole(req, req.params.userId, req.validated.body.roleId);
    return created(res, userRole, "Role assigned");
  }));

router.delete("/admin/users/:userId/roles/:roleId", requirePermission("admin:manageUsers"),
  validate(z.object({ params: z.object({ userId: uuid(), roleId: uuid() }) })),
  asyncHandler(async (req, res) => {
    await removeUserRole(req, req.params.roleId);
    return ok(res, {}, "Role removed");
  }));

export default router;
