/**
 * P0 Debug — Find OWNER user (full permissions), generate valid JWT, test all routes.
 */
import { chromium } from 'playwright';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_ACCESS_SECRET = 'velora-erp-access-secret-key-2026-min-24-chars';
const JWT_REFRESH_SECRET = 'velora-erp-refresh-secret-key-2026-min-24-chars';

const ROLE_PERMISSIONS = {
  OWNER: ['*'],
  ADMIN: ['admin:view', 'admin:manageRoles', 'admin:manageUsers'],
  SALES_MANAGER: ['sales:view', 'sales:create', 'sales:edit', 'sales:delete'],
  PURCHASE_MANAGER: ['purchase:view', 'purchase:create', 'purchase:edit', 'purchase:delete'],
  INVENTORY_MANAGER: ['inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete'],
  ACCOUNTANT: ['accounts:view', 'accounts:create', 'accounts:edit'],
  HR_MANAGER: ['hrms:view', 'hrms:create', 'hrms:edit'],
  CRM_MANAGER: ['crm:view', 'crm:create', 'crm:edit'],
  STORE_KEEPER: ['inventory:view', 'inventory:create', 'wms:view', 'wms:create'],
  PRODUCTION_OPERATOR: ['manufacturing:view', 'manufacturing:create', 'manufacturing:edit'],
  FINANCE_MANAGER: ['accounts:view', 'accounts:create', 'accounts:edit', 'accounts:delete'],
  MANUFACTURING_MANAGER: ['manufacturing:view', 'manufacturing:create', 'manufacturing:edit', 'manufacturing:delete'],
};

function permissionsFor(user) {
  const names = user.userRoles?.map(ur => ur.role?.name).filter(Boolean) || ['OWNER'];
  return [...new Set(names.flatMap(name => ROLE_PERMISSIONS[name] || []))];
}

const ROUTES = [
  '/', '/sales', '/sales/dashboard', '/crm', '/accounts', '/executive',
  '/inventory', '/inventory/products', '/inventory/reports', '/inventory/suppliers',
  '/purchase', '/manufacturing', '/wms', '/hrms', '/eam',
  '/supplier-portal', '/activity', '/settings', '/admin',
  '/company', '/branches', '/users', '/products',
];

(async () => {
  const prisma = new PrismaClient();

  // Find all users and their roles
  const users = await prisma.user.findMany({
    where: { isDeleted: false, isActive: true },
    include: {
      userRoles: { include: { role: true } },
    },
    take: 20,
  });

  console.log('All users:');
  for (const u of users) {
    const roles = u.userRoles.map(ur => ur.role?.name).join(', ') || 'NO ROLES';
    const perms = permissionsFor(u);
    console.log(`  ${u.email} — roles: [${roles}] — permissions: ${perms.length > 0 ? perms[0] === '*' ? 'ALL (*)' : `${perms.length} perms` : 'NONE'}`);
  }

  // Pick the user with the most permissions (prefer OWNER)
  let bestUser = users[0];
  let bestPerms = permissionsFor(bestUser);
  for (const u of users) {
    const p = permissionsFor(u);
    if (p.includes('*') || p.length > bestPerms.length) {
      bestUser = u;
      bestPerms = p;
    }
  }

  if (!bestUser) {
    console.log('No users found!');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`\nUsing user: ${bestUser.email}`);
  console.log(`Roles: ${bestUser.userRoles.map(ur => ur.role?.name).join(', ')}`);
  console.log(`Permissions: ${bestPerms.length > 0 && bestPerms[0] === '*' ? 'ALL (*)' : bestPerms.join(', ')}`);

  const accessToken = jwt.sign(
    {
      sub: bestUser.id,
      tenantId: bestUser.tenantId,
      companyId: bestUser.companyId,
      email: bestUser.email,
      permissions: bestPerms,
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '8h' },
  );

  const refreshToken = jwt.sign(
    { sub: bestUser.id, tenantId: bestUser.tenantId, companyId: bestUser.companyId, email: bestUser.email },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' },
  );

  await prisma.$disconnect();

  // Now test with this real token
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(({ accessToken, refreshToken, user }) => {
    localStorage.setItem('velora_access_token', accessToken);
    localStorage.setItem('velora_refresh_token', refreshToken);
    localStorage.setItem('velora_user', JSON.stringify({
      id: user.id, email: user.email, name: user.name,
    }));
  }, { accessToken, refreshToken, user: { id: bestUser.id, email: bestUser.email, name: bestUser.name } });

  const allErrors = [];

  for (const route of ROUTES) {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push({ message: err.message, stack: err.stack });
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    try {
      await page.goto(`http://localhost:5173${route}`, {
        waitUntil: 'networkidle',
        timeout: 20000,
      });
      await page.waitForTimeout(3000);

      const pageState = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasBoundary: text.includes('Something went wrong') || text.includes('Try Again') || text.includes('Failed to load module'),
          isBlank: document.getElementById('root')?.innerHTML.trim().length < 50,
          snippet: text.slice(0, 400),
          isLoginPage: window.location.pathname === '/login',
        };
      });

      const meaningfulPageErrors = pageErrors.filter(e =>
        !e.message.includes('ResizeObserver') && !e.message.includes('favicon')
      );
      const meaningfulConsoleErrors = consoleErrors.filter(e =>
        !e.includes('favicon') && !e.includes('ResizeObserver') &&
        !e.includes('401') && !e.includes('403')
      );

      if (meaningfulPageErrors.length > 0 || pageState.hasBoundary) {
        console.log(`\n❌ ${route}`);
        if (pageState.hasBoundary) console.log(`  ERROR BOUNDARY`);
        if (pageState.isLoginPage) console.log(`  → redirected to login`);
        for (const err of meaningfulPageErrors) {
          console.log(`  pageerror: ${err.message}`);
          if (err.stack) {
            const srcLines = err.stack.split('\n').slice(0, 15);
            for (const l of srcLines) console.log(`    ${l}`);
          }
        }
        allErrors.push({ route, errors: meaningfulPageErrors, boundary: pageState.hasBoundary });
      } else {
        console.log(`✅ ${route}`);
      }

      if (meaningfulConsoleErrors.length > 0) {
        for (const e of meaningfulConsoleErrors) {
          console.log(`  ⚠️  console.error: ${e.slice(0, 200)}`);
        }
      }
    } catch (err) {
      console.log(`🔴 ${route} — NAV ERROR: ${err.message}`);
    }

    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  }

  console.log('\n\n========================================');
  console.log('OWNER SESSION CRASH SUMMARY');
  console.log('========================================');
  if (allErrors.length === 0) {
    console.log('No crashes found with OWNER user.');
  } else {
    for (const { route, errors, boundary } of allErrors) {
      console.log(`\n❌ ${route}:`);
      if (boundary) console.log(`  Error Boundary triggered`);
      for (const err of errors) {
        console.log(`  Exception: ${err.message}`);
        if (err.stack) {
          const srcLines = err.stack.split('\n').filter(l => l.includes('src/')).slice(0, 10);
          for (const l of srcLines) console.log(`    ${l}`);
        }
      }
    }
  }
  console.log(`\nTotal crashes: ${allErrors.length}`);
  await browser.close();
})();
