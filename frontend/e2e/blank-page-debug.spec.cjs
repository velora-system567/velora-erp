const { test, expect } = require('@playwright/test');

const BACKEND_URL = 'http://localhost:4000';
const FRONTEND_URL = 'http://localhost:5173';
const CREDENTIALS = { email: 'jishan@velora.com', password: 'Velora@123' };

// Every route in App.jsx
const ALL_ROUTES = [
  { path: '/login', name: 'Login', public: true },
  { path: '/register', name: 'Register', public: true },
  { path: '/forgot-password', name: 'Forgot Password', public: true },
  { path: '/reset-password', name: 'Reset Password', public: true },
  { path: '/', name: 'Dashboard' },
  { path: '/company', name: 'Company' },
  { path: '/branches', name: 'Branches' },
  { path: '/users', name: 'Users' },
  { path: '/products', name: 'Products' },
  { path: '/sales', name: 'Sales' },
  { path: '/sales/dashboard', name: 'Owner Dashboard' },
  { path: '/purchase', name: 'Purchase' },
  { path: '/inventory', name: 'Inventory' },
  { path: '/inventory/products', name: 'Inventory Products' },
  { path: '/inventory/reports', name: 'Inventory Reports' },
  { path: '/inventory/suppliers', name: 'Inventory Suppliers' },
  { path: '/accounts', name: 'Accounts (Finance)' },
  { path: '/manufacturing', name: 'Manufacturing' },
  { path: '/crm', name: 'CRM' },
  { path: '/wms', name: 'WMS' },
  { path: '/executive', name: 'Executive (Reports)' },
  { path: '/hrms', name: 'HRMS' },
  { path: '/eam', name: 'EAM' },
  { path: '/supplier-portal', name: 'Supplier Portal' },
  { path: '/activity', name: 'Audit Log' },
  { path: '/settings', name: 'Settings' },
  { path: '/admin', name: 'Admin' },
  { path: '/access-denied', name: 'Access Denied' },
];

test('debug all routes for blank pages', async ({ page }) => {
  test.setTimeout(600000);

  // Login
  const r = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS),
  });
  const auth = (await r.json()).data;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((a) => {
    localStorage.setItem('velora_access_token', a.accessToken);
    localStorage.setItem('velora_refresh_token', a.refreshToken);
    localStorage.setItem('velora_user', JSON.stringify(a.user));
  }, auth);

  const results = [];

  for (const route of ALL_ROUTES) {
    const consoleErrors = [];
    const pageErrors = [];
    const networkErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push({ message: err.message, stack: err.stack || '' });
    });
    page.on('response', (resp) => {
      const s = resp.status();
      const url = resp.url();
      if (s >= 400 && url.includes('/api/')) {
        networkErrors.push(`${s} ${url.replace(FRONTEND_URL, '')}`);
      }
    });

    try {
      await page.goto(`${FRONTEND_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);

      const bodyText = (await page.evaluate(() => document.body?.innerText || '')).trim();
      const bodyHTML = (await page.evaluate(() => document.body?.innerHTML || '')).trim();
      const isBlank = bodyHTML.length < 50;

      // Take screenshot
      await page.screenshot({ path: `e2e/screenshots/debug-${route.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`, fullPage: false });

      const realConsoleErrors = consoleErrors.filter(e =>
        !e.includes('favicon') && !e.includes('ResizeObserver') && !e.includes('HMR') &&
        !e.includes('WebSocket') && !e.includes('Download the React DevTools')
      );

      const status = isBlank ? 'BLANK' :
        pageErrors.length > 0 ? 'EXCEPTION' :
        realConsoleErrors.length > 0 ? 'CONSOLE_ERROR' :
        networkErrors.length > 0 ? 'API_ERROR' :
        'OK';

      results.push({
        ...route,
        status,
        bodyLen: bodyText.length,
        pageErrors: pageErrors.map(e => e.message),
        consoleErrors: realConsoleErrors,
        networkErrors,
      });

      console.log(`${status === 'OK' ? '✅' : '❌'} ${route.name} (${route.path}) — textLen=${bodyText.length} — ${status}`);
      if (status !== 'OK') {
        if (pageErrors.length) console.log(`   Page errors: ${pageErrors.map(e => e.message).join(', ')}`);
        if (realConsoleErrors.length) console.log(`   Console: ${realConsoleErrors.slice(0, 3).join(' | ')}`);
        if (networkErrors.length) console.log(`   Network: ${networkErrors.slice(0, 3).join(' | ')}`);
      }
    } catch (err) {
      results.push({ ...route, status: 'NAVIGATION_FAILED', error: err.message });
      console.log(`❌ ${route.name} (${route.path}) — NAVIGATION FAILED: ${err.message}`);
    }

    // Remove listeners
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    page.removeAllListeners('response');
  }

  // Summary
  const blank = results.filter(r => r.status === 'BLANK');
  const exceptions = results.filter(r => r.status === 'EXCEPTION');
  const consoleErrors = results.filter(r => r.status === 'CONSOLE_ERROR');
  const apiErrors = results.filter(r => r.status === 'API_ERROR');
  const ok = results.filter(r => r.status === 'OK');

  console.log(`\n========== SUMMARY ==========`);
  console.log(`OK: ${ok.length}/${ALL_ROUTES.length}`);
  console.log(`BLANK: ${blank.length}`);
  console.log(`EXCEPTIONS: ${exceptions.length}`);
  console.log(`CONSOLE ERRORS: ${consoleErrors.length}`);
  console.log(`API ERRORS: ${apiErrors.length}`);

  if (blank.length) {
    console.log(`\n--- BLANK PAGES ---`);
    blank.forEach(r => console.log(`  ${r.name} (${r.path})`));
  }
  if (exceptions.length) {
    console.log(`\n--- EXCEPTIONS ---`);
    exceptions.forEach(r => {
      console.log(`  ${r.name} (${r.path}): ${r.pageErrors?.join(' | ')}`);
      console.log(`    Stack: ${r.pageErrors?.stack?.split('\n').slice(0, 5).join('\n    ')}`);
    });
  }
  if (consoleErrors.length) {
    console.log(`\n--- CONSOLE ERRORS ---`);
    consoleErrors.forEach(r => console.log(`  ${r.name} (${r.path}): ${r.consoleErrors?.slice(0, 2).join(' | ')}`));
  }
  if (apiErrors.length) {
    console.log(`\n--- API ERRORS ---`);
    apiErrors.forEach(r => console.log(`  ${r.name} (${r.path}): ${r.networkErrors?.join(' | ')}`));
  }

  // Fail the test if any page is blank
  expect(blank.length, `Found ${blank.length} blank pages`).toBe(0);
});
