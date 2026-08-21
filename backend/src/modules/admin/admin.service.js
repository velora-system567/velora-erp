/**
 * Admin Service — Role & Permission Management
 */
import { getPrisma } from "../../config/db.js";
import { writeAudit } from "../../utils/audit.js";
import { invalidatePermissionCache, clearPermissionCache } from "../../utils/permission-engine.js";

// ─── Roles ─────────────────────────────────────────────────────────────────

export async function listRoles(req) {
  const prisma = getPrisma();
  return prisma.role.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    include: {
      _count: { select: { userRoles: { where: { isDeleted: false } } } },
      rolePermissions: { where: { isDeleted: false }, include: { permission: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getRole(req, roleId) {
  const prisma = getPrisma();
  return prisma.role.findFirst({
    where: { id: roleId, tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    include: {
      rolePermissions: { where: { isDeleted: false }, include: { permission: true } },
    },
  });
}

export async function createRole(req, input) {
  const prisma = getPrisma();
  const { name, description, permissionKeys = [] } = input;

  const role = await prisma.role.create({
    data: {
      tenantId: req.tenantId,
      companyId: req.companyId,
      name: name.toUpperCase().replace(/\s+/g, "_"),
      description,
      createdBy: req.user.sub,
      updatedBy: req.user.sub,
    },
  });

  // Assign permissions — use upsert to be idempotent and safe
  if (permissionKeys.length > 0) {
    const permissions = await prisma.permission.findMany({
      where: { tenantId: req.tenantId, key: { in: permissionKeys }, isDeleted: false },
    });
    const permissionIds = permissions.map((p) => p.id);

    for (const permId of permissionIds) {
      await prisma.rolePermission.upsert({
        where: { tenantId_roleId_permissionId: { tenantId: req.tenantId, roleId: role.id, permissionId: permId } },
        create: { tenantId: req.tenantId, companyId: req.companyId, roleId: role.id, permissionId: permId, createdBy: req.user.sub, updatedBy: req.user.sub },
        update: { isDeleted: false, updatedBy: req.user.sub },
      });
    }
  }

  await writeAudit(req, { tableName: "roles", recordId: role.id, action: "ROLE_CREATED", newValue: role });
  return role;
}

export async function updateRole(req, roleId, input) {
  const prisma = getPrisma();
  const oldRole = await prisma.role.findFirst({ where: { id: roleId, tenantId: req.tenantId } });
  if (!oldRole) { const e = new Error("Role not found"); e.statusCode = 404; throw e; }

  const updateData = {};
  if (input.name) updateData.name = input.name.toUpperCase().replace(/\s+/g, "_");
  if (input.description !== undefined) updateData.description = input.description;
  updateData.updatedBy = req.user.sub;

  const role = await prisma.role.update({ where: { id: roleId }, data: updateData });

  // Update permissions if provided — use transactional upsert to avoid unique constraint conflicts
  if (input.permissionKeys) {
    // Resolve permission keys to IDs
    const permissions = await prisma.permission.findMany({
      where: { tenantId: req.tenantId, key: { in: input.permissionKeys }, isDeleted: false },
    });
    const permissionIds = permissions.map((p) => p.id);
    const desiredSet = new Set(permissionIds);

    await prisma.$transaction(async (tx) => {
      // 1. Fetch current active permission IDs for this role
      const current = await tx.rolePermission.findMany({
        where: { roleId, tenantId: req.tenantId, isDeleted: false },
        select: { permissionId: true },
      });
      const currentSet = new Set(current.map((r) => r.permissionId));

      // 2. Soft-delete only those NOT in desired set
      const toDelete = [...currentSet].filter((id) => !desiredSet.has(id));
      if (toDelete.length) {
        await tx.rolePermission.updateMany({
          where: { roleId, permissionId: { in: toDelete }, isDeleted: false },
          data: { isDeleted: true, updatedBy: req.user.sub },
        });
      }

      // 3. Upsert (create or un-delete) only those in desired set
      for (const permId of desiredSet) {
        await tx.rolePermission.upsert({
          where: { tenantId_roleId_permissionId: { tenantId: req.tenantId, roleId, permissionId: permId } },
          create: { tenantId: req.tenantId, companyId: req.companyId, roleId, permissionId: permId, createdBy: req.user.sub, updatedBy: req.user.sub },
          update: { isDeleted: false, updatedBy: req.user.sub },
        });
      }
    });

    // Invalidate cache for users with this role
    const usersWithRole = await prisma.userRole.findMany({
      where: { roleId, isDeleted: false },
      select: { userId: true },
    });
    usersWithRole.forEach((u) => invalidatePermissionCache(u.userId, req.tenantId));
  }

  await writeAudit(req, { tableName: "roles", recordId: role.id, action: "ROLE_UPDATED", oldValue: oldRole, newValue: role });
  return role;
}

export async function deleteRole(req, roleId) {
  const prisma = getPrisma();
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId: req.tenantId } });
  if (!role) { const e = new Error("Role not found"); e.statusCode = 404; throw e; }
  if (role.isSystem) { const e = new Error("System roles cannot be deleted"); e.statusCode = 400; throw e; }

  await prisma.role.update({
    where: { id: roleId },
    data: { isDeleted: true, updatedBy: req.user.sub },
  });

  // Soft-delete role permissions
  await prisma.rolePermission.updateMany({
    where: { roleId, isDeleted: false },
    data: { isDeleted: true, updatedBy: req.user.sub },
  });

  clearPermissionCache();
  await writeAudit(req, { tableName: "roles", recordId: role.id, action: "ROLE_DELETED", oldValue: role });
  return role;
}

// ─── Permissions ───────────────────────────────────────────────────────────

export async function listPermissions(req) {
  const prisma = getPrisma();
  // Permission has no `module` column — module is derived from the key prefix
  // (e.g. "sales:read"). Order by key; the client groups by module.
  return prisma.permission.findMany({
    where: { tenantId: req.tenantId, isDeleted: false },
    orderBy: [{ key: "asc" }],
  });
}

// ─── Users ─────────────────────────────────────────────────────────────────

export async function listUsers(req) {
  const prisma = getPrisma();
  return prisma.user.findMany({
    where: { tenantId: req.tenantId, companyId: req.companyId, isDeleted: false },
    include: {
      userRoles: {
        where: { isDeleted: false },
        include: { role: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function assignUserRole(req, userId, roleId) {
  const prisma = getPrisma();
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, isDeleted: false },
  });
  if (existing) return existing;

  // Validate role belongs to the same tenant
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId: req.tenantId } });
  if (!role) { const e = new Error("Role not found"); e.statusCode = 404; throw e; }

  // Validate target user belongs to the same tenant (prevents cross-tenant role assignment)
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId: req.tenantId } });
  if (!user) { const e = new Error("User not found in this tenant"); e.statusCode = 404; throw e; }

  const userRole = await prisma.userRole.create({
    data: {
      tenantId: req.tenantId,
      companyId: req.companyId,
      userId,
      roleId,
      createdBy: req.user.sub,
      updatedBy: req.user.sub,
    },
  });

  invalidatePermissionCache(userId, req.tenantId);
  await writeAudit(req, { tableName: "user_roles", recordId: userRole.id, action: "ROLE_ASSIGNED", newValue: { userId, roleId: role.id, roleName: role.name } });
  return userRole;
}

export async function removeUserRole(req, userRoleId) {
  const prisma = getPrisma();
  const ur = await prisma.userRole.findFirst({ where: { id: userRoleId, tenantId: req.tenantId } });
  if (!ur) { const e = new Error("User role not found"); e.statusCode = 404; throw e; }

  // Prevent removing the last OWNER role assignment
  if (ur.role.name === "OWNER") {
    const ownerCount = await prisma.userRole.count({
      where: { role: { name: "OWNER" }, tenantId: req.tenantId, isDeleted: false },
    });
    if (ownerCount <= 1) {
      const e = new Error("Cannot remove the last OWNER role assignment");
      e.statusCode = 400;
      throw e;
    }
  }

  await prisma.userRole.update({
    where: { id: userRoleId },
    data: { isDeleted: true, updatedBy: req.user.sub },
  });

  invalidatePermissionCache(ur.userId, req.tenantId);
  await writeAudit(req, { tableName: "user_roles", recordId: userRoleId, action: "ROLE_REMOVED", oldValue: ur });
}

// ─── System Health ──────────────────────────────────────────────────────────

export async function getSystemHealth(req) {
  const prisma = getPrisma();
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;
    const [userCount, roleCount, docCount, companyCount] = await Promise.all([
      prisma.user.count({ where: { tenantId: req.tenantId, isDeleted: false } }),
      prisma.role.count({ where: { tenantId: req.tenantId, isDeleted: false } }),
      prisma.businessDocument.count({ where: { tenantId: req.tenantId, isDeleted: false } }),
      prisma.company.count({ where: { tenantId: req.tenantId, isDeleted: false } }),
    ]);
    return {
      status: "healthy",
      dbLatency: `${dbLatency}ms`,
      uptime: process.uptime(),
      counts: { users: userCount, roles: roleCount, documents: docCount, companies: companyCount },
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
    };
  } catch {
    return { status: "unhealthy", dbLatency: "failed" };
  }
}
