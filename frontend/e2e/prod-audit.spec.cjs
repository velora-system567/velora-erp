const { test, expect } = require('@playwright/test');

const PROD_URL = 'https://velora-erp.vercel.app';
const CREDENTIALS = { email: 'jishan@velora.com', password: 'Velora@123' };

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

test('audit all routes on production', async ({ page }) => {
  test.setTimeout(600000);
  const r = await fetch(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS),
  });
  const auth = (await r.json()).data;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
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
    const failedRequests = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => { pageErrors.push({ message: err.message, stack: err.stack || '' }); });
    page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`));
    page.on('response', (resp) => {
      const s = resp.status();
      const url = resp.url();
      if (s >= 400 && url.includes('/api/')) networkErrors.push(`${s} ${url.replace(PROD_URL, '')}`);
    });

    try {
      await page.goto(`${PROD_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      const bodyText = (await page.evaluate(() => document.body?.innerText || '')).trim();
      const bodyHTML = (await page.evaluate(() => document.body?.innerHTML || '')).trim();
      const isBlank = bodyHTML.length < 50;
      await page.screenshot({ path: `e2e/screenshots/prod-${route.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`, fullPage: false });

      const realConsoleErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('ResizeObserver') && !e.includes('Download the React DevTools'));
      const status = isBlank ? 'BLANK' : pageErrors.length > 0 ? 'EXCEPTION' : realConsoleErrors.length > 0 ? 'CONSOLE_ERROR' : networkErrors.length > 0 ? 'API_ERROR' : 'OK';
      results.push({ ...route, status, bodyLen: bodyText.length, pageErrors: pageErrors.map(e => e.message), stacks: pageErrors.map(e => e.stack), consoleErrors: realConsoleErrors, networkErrors, failedRequests });
      console.log(`${status === 'OK' ? 'OK ' : 'FAIL'} ${route.name} (${route.path}) — textLen=${bodyText.length} — ${status}`);
      if (status !== 'OK') {
        if (pageErrors.length) console.log(`   PageError: ${pageErrors[0].message}`);
        if (realConsoleErrors.length) console.log(`   Console: ${realConsoleErrors.slice(0, 3).join(' | ')}`);
        if (networkErrors.length) console.log(`   Network: ${networkErrors.slice(0, 3).join(' | ')}`);
        if (failedRequests.length) console.log(`   FailedReq: ${failedRequests.slice(0, 3).join(' | ')}`);
      }
    } catch (err) {
      results.push({ ...route, status: 'NAV_FAIL', error: err.message });
      console.log(`FAIL ${route.name} (${route.path}) — NAV FAIL: ${err.message}`);
    }
    page.removeAllListeners('console'); page.removeAllListeners('pageerror'); page.removeAllListeners('requestfailed'); page.removeAllListeners('response');
  }

  const blank = results.filter(r => r.status === 'BLANK');
  const exceptions = results.filter(r => r.status === 'EXCEPTION');
  const consoleErrs = results.filter(r => r.status === 'CONSOLE_ERROR');
  const apiErrs = results.filter(r => r.status === 'API_ERROR');
  const ok = results.filter(r => r.status === 'OK');
  console.log(`\n========== PRODUCTION SUMMARY ==========`);
  console.log(`OK: ${ok.length}/${ALL_ROUTES.length}`);
  console.log(`BLANK: ${blank.length}`);
  console.log(`EXCEPTIONS: ${exceptions.length}`);
  console.log(`CONSOLE ERRORS: ${consoleErrs.length}`);
  console.log(`API ERRORS: ${apiErrs.length}`);
  blank.forEach(r => console.log(`BLANK: ${r.name} (${r.path})`));
  exceptions.forEach(r => console.log(`EXCEPTION: ${r.name} (${r.path}) :: ${r.pageErrors?.join(' | ')}`));
  apiErrs.forEach(r => console.log(`API: ${r.name} (${r.path}) :: ${r.networkErrors?.join(' | ')}`));

  const totalFailed = blank.length + exceptions.length;
  console.log(`TOTAL FAILED: ${totalFailed}`);
  expect(totalFailed, `Found ${totalFailed} failing pages`).toBe(0);
});
