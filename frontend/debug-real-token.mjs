/**
 * P0 Debug — Connect to the real database, find a user, generate a valid JWT,
 * then navigate every route capturing ALL errors.
 */
import { chromium } from 'playwright';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_ACCESS_SECRET = 'velora-erp-access-secret-key-2026-min-24-chars';
const JWT_REFRESH_SECRET = 'velora-erp-refresh-secret-key-2026-min-24-chars';

const ROUTES = [
  '/', '/sales', '/sales/dashboard', '/crm', '/accounts', '/executive',
  '/inventory', '/inventory/products', '/inventory/reports', '/inventory/suppliers',
  '/purchase', '/manufacturing', '/wms', '/hrms', '/eam',
  '/supplier-portal', '/activity', '/settings', '/admin',
  '/company', '/branches', '/users', '/products',
];

const ROLE_PERMISSIONS = {
  OWNER: ['*'],
};

function permissionsFor(user) {
  const names = user.userRoles?.map(ur => ur.role?.name).filter(Boolean) || ['OWNER'];
  return [...new Set(names.flatMap(name => ROLE_PERMISSIONS[name] || []))];
}

(async () => {
  // Step 1: Connect to DB and find a user
  console.log('--- Connecting to database ---');
  const prisma = new PrismaClient();

  const user = await prisma.user.findFirst({
    where: { isDeleted: false, isActive: true },
    include: {
      userRoles: { include: { role: true } },
    },
  });

  if (!user) {
    console.log('No users found in database!');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (${user.name})`);
  console.log(`Roles: ${user.userRoles.map(ur => ur.role?.name).join(', ')}`);

  // Step 2: Generate real JWT tokens
  const accessToken = jwt.sign(
    {
      sub: user.id,
      tenantId: user.tenantId,
      companyId: user.companyId,
      email: user.email,
      permissions: permissionsFor(user),
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '8h' },
  );

  const refreshToken = jwt.sign(
    { sub: user.id, tenantId: user.tenantId, companyId: user.companyId, email: user.email },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' },
  );

  console.log(`\nGenerated access token (first 50 chars): ${accessToken.slice(0, 50)}...`);
  console.log(`Permissions: ${JSON.stringify(permissionsFor(user)).slice(0, 200)}`);

  await prisma.$disconnect();

  // Step 3: Launch browser with real tokens
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(({ accessToken, refreshToken, user }) => {
    localStorage.setItem('velora_access_token', accessToken);
    localStorage.setItem('velora_refresh_token', refreshToken);
    localStorage.setItem('velora_user', JSON.stringify({
      id: user.id, email: user.email, name: user.name,
    }));
  }, { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } });

  const allErrors = [];

  for (const route of ROUTES) {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    try {
      await page.goto(`http://localhost:5173${route}`, {
        waitUntil: 'networkidle',
        timeout: 20000,
      });

      // Wait for React Query to settle
      await page.waitForTimeout(3000);

      // Check for error boundary
      const pageState = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasBoundary: text.includes('Something went wrong') || text.includes('Try Again') || text.includes('Failed to load'),
          isBlank: document.getElementById('root')?.innerHTML.trim().length < 50,
          snippet: text.slice(0, 300),
          isLoginPage: text.includes('Sign in') || text.includes('Login') || text.includes('Welcome back'),
        };
      });

      // Filter meaningful errors
      const meaningfulPageErrors = pageErrors.filter(e =>
        !e.message.includes('ResizeObserver') &&
        !e.message.includes('favicon')
      );

      const meaningfulConsoleErrors = consoleErrors.filter(e =>
        !e.includes('401') &&
        !e.includes('favicon') &&
        !e.includes('ResizeObserver')
      );

      if (meaningfulPageErrors.length > 0 || pageState.hasBoundary) {
        console.log(`\n❌ ${route}`);
        if (pageState.hasBoundary) console.log(`  ERROR BOUNDARY: ${pageState.snippet.slice(0, 150)}`);
        if (pageState.isLoginPage) console.log(`  Redirected to login`);
        for (const err of meaningfulPageErrors) {
          console.log(`  pageerror: ${err.message}`);
          if (err.stack) {
            const lines = err.stack.split('\n').slice(0, 12);
            for (const l of lines) console.log(`    ${l}`);
          }
        }
        allErrors.push({ route, errors: meaningfulPageErrors, boundary: pageState.hasBoundary });
      } else {
        const status = pageState.hasBoundary ? '❌' : pageState.isLoginPage ? '🔄' : '✅';
        console.log(`${status} ${route}${pageState.isLoginPage ? ' (redirected to login)' : ''}`);
      }

      if (meaningfulConsoleErrors.length > 0) {
        for (const e of meaningfulConsoleErrors) {
          console.log(`  console.error: ${e.slice(0, 200)}`);
        }
      }
    } catch (err) {
      console.log(`🔴 ${route} — NAVIGATION ERROR: ${err.message}`);
      allErrors.push({ route, errors: [{ message: err.message, stack: err.stack }] });
    }

    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  }

  console.log('\n\n========================================');
  console.log('REAL SESSION CRASH SUMMARY');
  console.log('========================================');

  if (allErrors.length === 0) {
    console.log('No crashes found with real session.');
  } else {
    for (const { route, errors, boundary } of allErrors) {
      console.log(`\n❌ ${route}:`);
      if (boundary) console.log(`  Error Boundary triggered`);
      for (const err of errors) {
        console.log(`  Exception: ${err.message}`);
        if (err.stack) {
          const srcLines = err.stack.split('\n').filter(l =>
            l.includes('src/') || l.includes('localhost')
          ).slice(0, 10);
          for (const l of srcLines) console.log(`    ${l}`);
        }
      }
    }
  }

  console.log(`\nTotal crashes: ${allErrors.length}`);
  await browser.close();
})();
