/**
 * Velora ERP — Permission Engine
 *
 * Enterprise-grade centralized permission system.
 * All permission checks go through this engine.
 *
 * Architecture:
 *   Role → Assigned Permissions → Permission Engine → UI/API
 *
 * Every API endpoint, menu item, and button checks permissions
 * through this engine. No hardcoded permissions anywhere.
 */
import { getPrisma } from "../config/db.js";
import { writeAudit } from "./audit.js";

// ─── Module Permission Definitions ───────────────────────────────────────────
// This is the canonical list of all permissions in the system.
// Every module registers its namespace here.

export const PERMISSION_NAMESPACES = {
  DASHBOARD: {
    module: "dashboard",
    label: "Dashboard",
    permissions: ["view"],
  },
  SALES: {
    module: "sales",
    label: "Sales",
    permissions: ["view", "create", "edit", "delete", "approve", "payment", "export", "print"],
  },
  PURCHASE: {
    module: "purchase",
    label: "Procurement",
    permissions: ["view", "create", "edit", "delete", "approve", "payment", "export"],
  },
  INVENTORY: {
    module: "inventory",
    label: "Inventory",
    permissions: ["view", "create", "edit", "delete", "adjust", "transfer", "receive", "dispatch", "export"],
  },
  ACCOUNTS: {
    module: "accounts",
    label: "Finance",
    permissions: ["view", "create", "edit", "delete", "journal", "report", "approve", "payment", "receipt", "export"],
  },
  MANUFACTURING: {
    module: "manufacturing",
    label: "Manufacturing",
    permissions: ["view", "create", "edit", "delete", "approve", "bom", "quality", "workOrder", "export"],
  },
  HR: {
    module: "hr",
    label: "HR",
    permissions: ["view", "create", "edit", "delete", "payroll", "attendance", "leaveapprove"],
  },
  CRM: {
    module: "crm",
    label: "CRM",
    permissions: ["view", "create", "edit", "delete", "convertLead", "assignLead"],
  },
  REPORTS: {
    module: "reports",
    label: "Reports",
    permissions: ["view", "export", "print"],
  },
  AUDIT: {
    module: "audit",
    label: "Audit",
    permissions: ["view", "export"],
  },
  SETTINGS: {
    module: "settings",
    label: "Settings",
    permissions: ["view", "edit"],
  },
  ADMIN: {
    module: "admin",
    label: "Administration",
    permissions: ["view", "manageRoles", "manageUsers", "managePermissions", "manageBranches", "manageCompanies", "systemConfig"],
  },
  USERS: {
    module: "users",
    label: "User Management",
    permissions: ["view", "create", "edit", "delete", "resetPassword", "assignRoles"],
  },
  BRANCHES: {
    module: "branches",
    label: "Branches",
    permissions: ["view", "create", "edit", "delete"],
  },
  COMPANY: {
    module: "company",
    label: "Company",
    permissions: ["view", "create", "edit", "delete"],
  },
  SUPPLIER_PORTAL: {
    module: "supplierPortal",
    label: "Supplier Portal",
    permissions: ["view", "create", "edit"],
  },
  EAM: {
    module: "eam",
    label: "Asset Management",
    permissions: ["view", "create", "edit", "delete", "maintenance"],
  },
};

/**
 * Build permission keys from namespace definitions.
 * Returns an array of "module:action" strings.
 */
export function buildPermissionKeys(namespace) {
  return namespace.permissions.map((p) => `${namespace.module}:${p}`);
}

/**
 * Generate the full set of all possible permission keys.
 */
export function getAllPermissionKeys() {
  const keys = [];
  for (const ns of Object.values(PERMISSION_NAMESPACES)) {
    for (const p of ns.permissions) {
      keys.push({ key: `${ns.module}:${p}`, module: ns.module, action: p, label: `${ns.label} - ${p.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}` });
    }
  }
  return keys;
}

/**
 * Default permission sets for each role.
 * Role keys are stored in DB as role names.
 */
/**
 * Default permission sets for each role.
 * Maps role enum values (used in DB) to permission keys.
 * The admin UI can create additional roles via the Permission model directly.
 *
 * NOTE: DB currently uses UserRoleName enum. New role names (FOUNDER, VIEWER, etc.)
 * are mapped at the application layer. Run `prisma db push` after deploying to
 * unlock the full set of DB role types.
 */
export const ROLE_DEFAULT_PERMISSIONS = {
  OWNER: { permissions: ["*"] },
  ADMIN: { permissions: buildAllPermissionKeys() },
  // Sales & CRM
  SALES_MANAGER: { permissions: [
    "dashboard:view",
    "sales:view", "sales:create", "sales:edit", "sales:approve", "sales:payment", "sales:export", "sales:print",
    "crm:view", "crm:create", "crm:edit", "crm:convertLead", "crm:assignLead",
    "reports:view", "reports:export",
    "inventory:view",
  ]},
  SALESMAN: { permissions: [
    "dashboard:view",
    "sales:view", "sales:create", "sales:edit", "sales:export",
    "crm:view", "crm:create", "crm:edit",
    "inventory:view",
  ]},
  // Inventory
  STORE_KEEPER: { permissions: [
    "inventory:view", "inventory:create", "inventory:edit", "inventory:adjust", "inventory:transfer", "inventory:receive", "inventory:dispatch",
    "purchase:view",
  ]},
  // Procurement
  PURCHASE_MANAGER: { permissions: [
    "dashboard:view",
    "purchase:view", "purchase:create", "purchase:edit", "purchase:approve", "purchase:payment", "purchase:export",
    "inventory:view",
    "reports:view", "reports:export",
  ]},
  // Finance
  ACCOUNTANT: { permissions: [
    "dashboard:view",
    "accounts:view", "accounts:create", "accounts:edit", "accounts:journal", "accounts:report", "accounts:export",
    "sales:view", "purchase:view", "inventory:view",
  ]},
  // Manufacturing
  PRODUCTION_OPERATOR: { permissions: [
    "dashboard:view",
    "manufacturing:view", "manufacturing:create", "manufacturing:edit", "manufacturing:approve", "manufacturing:bom", "manufacturing:quality", "manufacturing:workOrder", "manufacturing:export",
    "inventory:view",
    "reports:view",
  ]},
  // HR
  HR_MANAGER: { permissions: [
    "dashboard:view",
    "hr:view", "hr:create", "hr:edit", "hr:payroll", "hr:attendance", "hr:leaveapprove",
    "users:view", "users:create", "users:edit",
    "reports:view",
  ]},
};

function buildAllPermissionKeys() {
  const keys = [];
  for (const ns of Object.values(PERMISSION_NAMESPACES)) {
    keys.push(...buildPermissionKeys(ns));
  }
  return keys;
}

// ─── Cached Permission Loading ───────────────────────────────────────────────

const permissionCache = new Map();

/**
 * Load permissions for a user by their role.
 * Caches per session (by userId + tenantId).
 */
export async function loadUserPermissions(prisma, { userId, tenantId, companyId }) {
  const cacheKey = `${tenantId}:${userId}`;

  // Check cache
  const cached = permissionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        where: { isDeleted: false },
        include: {
          role: {
            include: {
              rolePermissions: {
                where: { isDeleted: false },
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return [];

  // Collect all permissions from all roles
  const permissionSet = new Set();
  let isSuperAdmin = false;

  for (const ur of user.userRoles) {
    const role = ur.role;
    if (role.name === "OWNER") {
      isSuperAdmin = true;
      permissionSet.add("*");
      break;
    }
    for (const rp of role.rolePermissions) {
      if (rp.permission?.key) {
        permissionSet.add(rp.permission.key);
      }
    }
  }

  const permissions = isSuperAdmin ? ["*"] : [...permissionSet];

  // Cache for 5 minutes
  permissionCache.set(cacheKey, {
    permissions,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  return permissions;
}

/**
 * Invalidate cached permissions for a user (call after role change).
 */
export function invalidatePermissionCache(userId, tenantId) {
  permissionCache.delete(`${tenantId}:${userId}`);
}

/**
 * Clear entire permission cache (call after bulk changes).
 */
export function clearPermissionCache() {
  permissionCache.clear();
}

// ─── Permission Check Helpers ────────────────────────────────────────────────

/**
 * Check if a permission array has a specific key.
 * Supports "*" wildcard (super admin).
 */
export function hasPermission(permissions, requiredKey) {
  if (!permissions || !requiredKey) return false;
  if (permissions.includes("*")) return true;
  return permissions.includes(requiredKey);
}

/**
 * Check if user has ANY of the given permissions.
 */
export function hasAnyPermission(permissions, requiredKeys) {
  return requiredKeys.some((key) => hasPermission(permissions, key));
}

/**
 * Check if user has ALL of the given permissions.
 */
export function hasAllPermissions(permissions, requiredKeys) {
  return requiredKeys.every((key) => hasPermission(permissions, key));
}

/**
 * Middleware: require a specific permission.
 */
export function requirePermission(permissionKey) {
  return (req, res, next) => {
    const permissions = req.user?.permissions || [];
    if (permissions.includes("*") || permissions.includes(permissionKey)) {
      return next();
    }
    const error = new Error(`Access denied. Required: ${permissionKey}`);
    error.statusCode = 403;
    return next(error);
  };
}

/**
 * Middleware: require any of the given permissions.
 */
export function requireAnyPermission(permissionKeys) {
  return (req, res, next) => {
    const permissions = req.user?.permissions || [];
    if (permissions.includes("*") || permissionKeys.some((k) => permissions.includes(k))) {
      return next();
    }
    const error = new Error(`Access denied. Required one of: ${permissionKeys.join(", ")}`);
    error.statusCode = 403;
    return next(error);
  };
}

// ─── Module Permission Helpers ────────────────────────────────────────────────

/**
 * Get module-level permission checks for sidebar visibility.
 */
export function getModulePermission(module) {
  return `${module}:view`;
}

/**
 * Check if user can view a module (for sidebar rendering).
 */
export function canViewModule(permissions, module) {
  return hasPermission(permissions, `${module}:view`) || hasPermission(permissions, getModulePermission(module));
}

/**
 * Get all modules a user has access to.
 */
export function getUserModules(permissions) {
  return Object.values(PERMISSION_NAMESPACES)
    .filter((ns) => canViewModule(permissions, ns.module))
    .map((ns) => ns.module);
}

// ─── Audit Logging for Permission Changes ────────────────────────────────────

export async function logPermissionChange(req, { roleId, roleName, oldPermissions, newPermissions, reason }) {
  await writeAudit(req, {
    tableName: "role_permissions",
    recordId: roleId,
    action: "PERMISSION_CHANGED",
    oldValue: { role: roleName, permissions: oldPermissions },
    newValue: { role: roleName, permissions: newPermissions, reason: reason || null },
  }).catch((err) => console.error("[perm] Audit error:", err.message));
}
