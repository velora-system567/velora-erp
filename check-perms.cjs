const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rpCount = await p.rolePermission.count();
  const permCount = await p.permission.count();
  const roleCount = await p.role.count();
  console.log('rolePermissions:', rpCount, '| permissions:', permCount, '| roles:', roleCount);

  // Permissions actually assigned to the SALES_MANAGER role
  const role = await p.role.findFirst({ where: { name: 'SALES_MANAGER' } });
  if (role) {
    const rps = await p.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permission: { select: { key: true } } },
    });
    console.log('SALES_MANAGER rolePermissions:', rps.map((r) => r.permission.key).join(', ') || '(none)');
  }

  // Sample of Permission keys present
  const perms = await p.permission.findMany({ select: { key: true }, take: 10 });
  console.log('Sample permission keys:', perms.map((x) => x.key).join(', '));

  // The loadUserPermissions result for SALES_MANAGER user leena
  const leena = await p.user.findUnique({
    where: { id: 'c42cb47b-ae78-479e-b08e-48e383502dea' },
    include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
  });
  if (leena) {
    const set = new Set();
    let isSuper = false;
    for (const ur of leena.userRoles) {
      if (ur.role.name === 'OWNER') { isSuper = true; break; }
      for (const rp of ur.role.rolePermissions) if (rp.permission?.key) set.add(rp.permission.key);
    }
    console.log('Leena effective permissions:', isSuper ? '["*"]' : JSON.stringify([...set]));
  }
  await p.$disconnect();
})();
