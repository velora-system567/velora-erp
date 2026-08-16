/**
 * P0 Debug — Limited permission user. Capture the EXACT error with full stack trace.
 */
import { chromium } from 'playwright';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_ACCESS_SECRET = 'velora-erp-access-secret-key-2026-min-24-chars';
const JWT_REFRESH_SECRET = 'velora-erp-refresh-secret-key-2026-min-24-chars';

const ROUTES = ['/', '/sales', '/sales/dashboard', '/crm', '/accounts', '/executive'];

(async () => {
  const prisma = new PrismaClient();

  // Get the PURCHASE_MANAGER user (limited permissions)
  const user = await prisma.user.findFirst({
    where: { isDeleted: false, isActive: true, email: 'aarti.rao51@velora.com' },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) { console.log('User not found'); process.exit(1); }

  console.log(`User: ${user.email}, Roles: ${user.userRoles.map(ur => ur.role?.name).join(', ')}`);

  const accessToken = jwt.sign(
    { sub: user.id, tenantId: user.tenantId, companyId: user.companyId, email: user.email, permissions: [] },
    JWT_ACCESS_SECRET, { expiresIn: '8h' }
  );
  const refreshToken = jwt.sign(
    { sub: user.id, tenantId: user.tenantId, companyId: user.companyId, email: user.email },
    JWT_REFRESH_SECRET, { expiresIn: '7d' }
  );

  await prisma.$disconnect();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(({ accessToken, refreshToken, user }) => {
    localStorage.setItem('velora_access_token', accessToken);
    localStorage.setItem('velora_refresh_token', refreshToken);
    localStorage.setItem('velora_user', JSON.stringify({ id: user.id, email: user.email, name: user.name }));
  }, { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } });

  for (const route of ROUTES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TESTING: ${route}`);
    console.log('='.repeat(60));

    const allConsole = [];
    const pageErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      allConsole.push({ type: msg.type(), text: msg.text(), args: msg.args() });
    });

    await page.goto(`http://localhost:5173${route}`, {
      waitUntil: 'networkidle', timeout: 20000,
    });
    await page.waitForTimeout(4000);

    // Get page state
    const state = await page.evaluate(() => {
      return {
        pathname: window.location.pathname,
        hasBoundary: document.body.innerText.includes('Something went wrong') ||
                     document.body.innerText.includes('Try Again'),
        bodyText: document.body.innerText.slice(0, 600),
      };
    });

    console.log(`\nFinal pathname: ${state.pathname}`);
    console.log(`Error boundary visible: ${state.hasBoundary}`);

    if (pageErrors.length > 0) {
      console.log(`\n--- PAGE ERRORS (${pageErrors.length}) ---`);
      for (const err of pageErrors) {
        console.log(`\nEXCEPTION: ${err.message}`);
        console.log(`STACK:\n${err.stack}`);
      }
    }

    // Check console for our RouteErrorBoundary log
    const boundaryLogs = allConsole.filter(c => c.text.includes('[RouteErrorBoundary]'));
    if (boundaryLogs.length > 0) {
      console.log(`\n--- ERROR BOUNDARY LOGS ---`);
      for (const log of boundaryLogs) {
        console.log(log.text);
      }
    }

    // Show ALL console errors (not just filtered)
    const errors = allConsole.filter(c => c.type === 'error');
    if (errors.length > 0) {
      console.log(`\n--- ALL CONSOLE ERRORS (${errors.length}) ---`);
      for (const e of errors) {
        console.log(`  [${e.type}] ${e.text.slice(0, 300)}`);
      }
    }

    // Show any console warnings too
    const warnings = allConsole.filter(c => c.type === 'warning' || c.type === 'warn');
    if (warnings.length > 0) {
      console.log(`\n--- WARNINGS (${warnings.length}) ---`);
      for (const w of warnings) {
        console.log(`  ${w.text.slice(0, 200)}`);
      }
    }

    console.log(`\n--- PAGE TEXT (first 400 chars) ---`);
    console.log(state.bodyText);

    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  }

  await browser.close();
})();
