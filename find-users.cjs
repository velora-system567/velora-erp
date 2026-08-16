const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const roles = ['SALES_MANAGER', 'ACCOUNTANT', 'HR_MANAGER', 'SALESMAN', 'STORE_KEEPER', 'PURCHASE_MANAGER', 'PRODUCTION_OPERATOR'];
  for (const role of roles) {
    const u = await p.user.findFirst({
      where: { isDeleted: false, isActive: true, userRoles: { some: { role: { name: role } } } },
      select: { id: true, email: true, name: true, tenantId: true, companyId: true },
    });
    console.log(role + ' => ' + (u ? u.email + ' | ' + u.id : 'NONE'));
  }
  await p.$disconnect();
})();
