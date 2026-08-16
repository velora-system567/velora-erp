/**
 * Live audit — real signed JWT for an OWNER user, navigates every route,
 * captures exact console errors, page errors (with stacks), and failed requests.
 */
import { chromium } from 'playwright';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = 'velora-erp-access-secret-key-2026-min-24-chars';
const REFRESH_SECRET = 'velora-erp-refresh-secret-key-2026-min-24-chars';

const USER = {
  id: '16df2e5e-92ea-4ca5-82ec-54e0d4d804a6',
  email: 'sanjay.bhatt18@velora.com',
  name: 'Sanjay Bhatt',
  tenantId: '6ece100f-38d4-4144-9e15-f68e2835c0d7',
  companyId: 'eb471efc-13b3-42a8-85e4-1a816dfac7b6',
};

const ROUTES = [
  ['/', 'Dashboard'],
  ['/company', 'Company'],
  ['/branches', 'Branches'],
  ['/users', 'Users'],
  ['/products', 'Products'],
  ['/sales', 'Sales'],
  ['/sales/dashboard', 'Sales Dashboard'],
  ['/purchase', 'Purchase'],
  ['/inventory', 'Inventory'],
  ['/inventory/products', 'Inventory Products'],
  ['/inventory/reports', 'Inventory Reports'],
  ['/inventory/suppliers', 'Inventory Suppliers'],
  ['/accounts', 'Accounts'],
  ['/manufacturing', 'Manufacturing'],
  ['/crm', 'CRM'],
  ['/wms', 'WMS'],
  ['/executive', 'Executive Reports'],
  ['/hrms', 'HRMS'],
  ['/eam', 'EAM'],
  ['/supplier-portal', 'Supplier Portal'],
  ['/activity', 'Audit Log'],
  ['/settings', 'Settings'],
  ['/admin', 'Admin'],
];

(async () => {
  const accessToken = jwt.sign(
    { sub: USER.id, tenantId: USER.tenantId, companyId: USER.companyId, email: USER.email, permissions: [] },
    ACCESS_SECRET, { expiresIn: '8h' }
  );
  const refreshToken = jwt.sign(
    { sub: USER.id, tenantId: USER.tenantId, companyId: USER.companyId, email: USER.email },
    REFRESH_SECRET, { expiresIn: '7d' }
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(({ accessToken, refreshToken, user }) => {
    localStorage.setItem('velora_access_token', accessToken);
    localStorage.setItem('velora_refresh_token', refreshToken);
    localStorage.setItem('velora_user', JSON.stringify(user));
  }, { accessToken, refreshToken, user: { id: USER.id, email: USER.email, name: USER.name } });

  const results = [];

  for (const [route, label] of ROUTES) {
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedReqs = [];
    const badResponses = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), loc: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push({ message: err.message, stack: err.stack });
    });
    page.on('requestfailed', (req) => {
      failedReqs.push({ url: req.url(), error: req.failure()?.errorText });
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        badResponses.push({ url: res.url(), status: res.status() });
      }
    });

    let boundaryText = '';
    try {
      await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(2500);
      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      boundaryText = bodyText.slice(0, 300);
    } catch (err) {
      pageErrors.push({ message: `NAV: ${err.message}`, stack: '' });
    }

    // Filter noise
    const realConsole = consoleErrors.filter((c) =>
      !/Failed to load resource/.test(c.text) &&
      !/ResizeObserver/.test(c.text)
    );
    const realBad = badResponses.filter((r) => !/favicon/.test(r.url));
    const realFailed = failedReqs.filter((r) => !/favicon/.test(r.url));

    const hasBoundary = /Something went wrong|Failed to load module|Try Again/.test(boundaryText);
    const isBlank = boundaryText.trim().length < 20;

    const problems = [];
    for (const pe of pageErrors) problems.push(`PAGEERROR: ${pe.message}`);
    for (const c of realConsole) problems.push(`CONSOLE: ${c.text}`);
    for (const r of realFailed) problems.push(`FAILEDREQ: ${r.url} (${r.error})`);
    for (const r of realBad) problems.push(`HTTP${r.status}: ${r.url}`);
    if (hasBoundary) problems.push('ERROR BOUNDARY TRIGGERED');
    if (isBlank) problems.push('BLANK PAGE');

    results.push({ route, label, problems, pageErrors, hasBoundary });

    if (problems.length === 0) {
      console.log(`✅ ${label} (${route})`);
    } else {
      console.log(`\n❌ ${label} (${route}) — ${problems.length} problem(s)`);
      for (const p of problems.slice(0, 15)) console.log(`   ${p}`);
      for (const pe of pageErrors) {
        const lines = (pe.stack || '').split('\n')
          .filter((l) => l.includes('src/') || l.includes('node_modules/.vite'))
          .slice(0, 6);
        if (lines.length) {
          console.log('   stack:');
          for (const l of lines) console.log(`     ${l.trim()}`);
        }
      }
    }

    await page.close();
  }

  console.log('\n\n========================================');
  console.log('AUDIT SUMMARY');
  console.log('========================================');
  let total = 0;
  for (const r of results) {
    if (r.problems.length) {
      total += r.problems.length;
      console.log(`❌ ${r.label} (${r.route}) — ${r.problems.length} problem(s)`);
    }
  }
  console.log(`\nRoutes with problems: ${results.filter((r) => r.problems.length).length}/${results.length}. Total problems: ${total}`);
  await browser.close();
})();
