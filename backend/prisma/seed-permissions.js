/**
 * Seed script — Populate all permissions and default roles.
 *
 * Run: npx prisma db push && node prisma/seed-permissions.js
 * Or: npm run seed-permissions
 *
 * This creates the canonical set of permissions and default
 * system roles in the database. Safe to re-run (upserts).
 */
import { getPrisma } from "../src/config/db.js";
import { PERMISSION_NAMESPACES, ROLE_DEFAULT_PERMISSIONS } from "../src/utils/permission-engine.js";

async function seed() {
  const prisma = getPrisma();
  console.log("🌱 Starting permission seed...");

  // Get all tenants
  const tenants = await prisma.tenant.findMany({ where: { isDeleted: false } });

  if (tenants.length === 0) {
    console.log("⚠️  No tenants found. Skipping seed.");
    console.log("   Register a tenant first, then run this script.");
    return;
  }

  for (const tenant of tenants) {
    const companies = await prisma.company.findMany({
      where: { tenantId: tenant.id, isDeleted: false },
    });

    for (const company of companies) {
      await seedTenant(prisma, tenant.id, company.id);
    }
  }

  console.log("✅ Permission seed complete!");
  await prisma.$disconnect();
}

async function seedTenant(prisma, tenantId, companyId) {
  console.log(`   Seeding tenant ${tenantId.slice(0, 8)}... company ${companyId.slice(0, 8)}`);

  // ─── 1. Create all permissions ──────────────────────────────────────────
  const permissionMap = new Map();

  for (const [nsKey, ns] of Object.entries(PERMISSION_NAMESPACES)) {
    for (const action of ns.permissions) {
      const key = `${ns.module}:${action}`;
      const perm = await prisma.permission.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: {
          tenantId,
          companyId,
          key,
          description: `${ns.label} - ${action}`,
        },
        update: { description: `${ns.label} - ${action}`, isDeleted: false },
      });
      permissionMap.set(key, perm.id);
    }
  }

  console.log(`      ✓ ${permissionMap.size} permissions synced`);

  // ─── 2. Create default roles ────────────────────────────────────────────
  for (const [roleKey, config] of Object.entries(ROLE_DEFAULT_PERMISSIONS)) {
    const roleName = roleKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const role = await prisma.role.upsert({
      where: { tenantId_companyId_name: { tenantId, companyId, name: roleKey } },
      create: {
        tenantId,
        companyId,
        name: roleKey,
        description: `${roleName} — auto-created system role`,
        isSystem: true,
      },
      update: { isDeleted: false },
    });

    // Remove existing role permissions
    await prisma.rolePermission.updateMany({
      where: { roleId: role.id, isDeleted: false },
      data: { isDeleted: true },
    });

    // Assign permissions from the default set
    if (config.isSuperAdmin || config.permissions.includes("*")) {
      // Super admin: assign ALL permissions
      for (const [, permId] of permissionMap) {
        await prisma.rolePermission.create({
          data: {
            tenantId,
            companyId,
            roleId: role.id,
            permissionId: permId,
          },
        }).catch(() => {}); // ignore duplicates
      }
    } else {
      // Assign specific permissions
      for (const permKey of config.permissions) {
        const permId = permissionMap.get(permKey);
        if (permId) {
          await prisma.rolePermission.create({
            data: {
              tenantId,
              companyId,
              roleId: role.id,
              permissionId: permId,
            },
          }).catch(() => {}); // ignore duplicates
        }
      }
    }

    console.log(`      ✓ Role "${roleKey}" synced with permissions`);
  }
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
