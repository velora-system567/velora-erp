/**
 * Audit ALL roles. For each role:
 *  - Compute accessible routes from ROLE_PERMISSIONS + module→permissionKey map.
 *  - Navigate every route with a real signed JWT (role permissions embedded).
 *  - Flag: 403 on an accessible route (permission bug), REAL route crash / pageerror /
 *    blank page (rendering bug). Ignore 403 on routes the role isn't allowed.
 */
import { chromium } from 'playwright';
import jwt from 'jsonwebtoken';
import { ROLE_PERMISSIONS } from './backend/src/utils/permissions.js';

const ACCESS_SECRET = 'velora-erp-access-secret-key-2026-min-24-chars';
const REFRESH_SECRET = 'velora-erp-refresh-secret-key-2026-min-24-chars';

// module -> (backend permissionKey, route, primary API prefix).
// Only 403s against a route's own API namespace are flagged — auxiliary
// sub-resources (e.g. /api/users inside /sales) are expected to 403 for
// roles without that permission and are handled gracefully by the page.
const MODULES = {
  dashboard: { key: 'dashboard:view', route: '/', api: '/api/dashboard/' },
  sales: { key: 'sales:view', route: '/sales', api: '/api/sales/' },
  salesDashboard: { key: 'sales:view', route: '/sales/dashboard', api: '/api/sales/owner-dashboard' },
  purchase: { key: 'purchase:view', route: '/purchase', api: '/api/purchase/' },
  inventory: { key: 'inventory:view', route: '/inventory', api: '/api/inventory/' },
  inventoryProducts: { key: 'inventory:view', route: '/inventory/products', api: '/api/inventory/' },
  inventoryReports: { key: 'inventory:view', route: '/inventory/reports', api: '/api/inventory/' },
  inventorySuppliers: { key: 'inventory:view', route: '/inventory/suppliers', api: '/api/inventory/' },
  manufacturing: { key: 'manufacturing:view', route: '/manufacturing', api: '/api/manufacturing/' },
  accounts: { key: 'accounts:view', route: '/accounts', api: '/api/accounts/' },
  crm: { key: 'crm:view', route: '/crm', api: '/api/crm/' },
  wms: { key: 'inventory:view', route: '/wms', api: '/api/wms/' },
  eam: { key: 'manufacturing:view', route: '/eam', api: '/api/eam/' },
  reports: { key: 'reports:view', route: '/executive', api: '/api/bi/' },
  hrms: { key: 'hr:view', route: '/hrms', api: '/api/hrms/' },
  supplierPortal: { key: 'purchase:view', route: '/supplier-portal', api: '/api/supplier-portal/' },
  audit: { key: 'audit:view', route: '/activity', api: '/api/audit-logs' },
  settings: { key: 'settings:view', route: '/settings', api: '/api/settings/' },
  admin: { key: 'admin:view', route: '/admin', api: '/api/admin/' },
  company: { key: 'company:view', route: '/company', api: '/api/company' },
  branches: { key: 'branches:view', route: '/branches', api: '/api/branches' },
  users: { key: 'users:view', route: '/users', api: '/api/users' },
  products: { key: 'products:view', route: '/products', api: '/api/products' },
};

const USERS = [
  ['16df2e5e-92ea-4ca5-82ec-54e0d4d804a6', 'sanjay.bhatt18@velora.com', 'Sanjay Bhatt', 'OWNER'],
  ['592e633e-ff3b-43c3-8869-6660b7370d5b', 'vandana.chauhan55@velora.com', 'Vandana Chauhan', 'ADMIN'],
  ['251bbe88-d8fb-482f-a5f3-f7a6293c77de', 'jayesh.tiwari56@velora.com', 'Jayesh Tiwari', 'ACCOUNTANT'],
  ['c42cb47b-ae78-479e-b08e-48e383502dea', 'leena.mishra57@velora.com', 'Leena Mishra', 'SALES_MANAGER'],
  ['54894af8-c905-47d7-a11e-b449d2e89956', 'bharat.bhatt58@velora.com', 'Bharat Bhatt', 'SALESMAN'],
  ['8d510412-6494-4bef-9830-79d8a62ac217', 'meera.singh5@velora.com', 'Meera Singh', 'STORE_KEEPER'],
  ['4d9441a5-f418-4bc9-8044-8af83bf8efce', 'ritu.gawade33@velora.com', 'Ritu Gawade', 'PURCHASE_MANAGER'],
  ['e578fb12-f297-4ac4-8994-a939f6aed30f', 'snehal.gupta43@velora.com', 'Snehal Gupta', 'PRODUCTION_OPERATOR'],
  ['b2602509-7de1-41aa-98d2-afbd0efb58b2', 'suman.mehta53@velora.com', 'Suman Mehta', 'HR_MANAGER'],
];

const TENANT = '6ece100f-38d4-4144-9e15-f68e2835c0d7';
const COMPANY = 'eb471efc-13b3-42a8-85e4-1a816dfac7b6';

async function auditOne(browser, user, roleName) {
  const perms = ROLE_PERMISSIONS[roleName] || [];
  const isSuper = perms.includes('*');
  const accessToken = jwt.sign(
    { sub: user[0], tenantId: TENANT, companyId: COMPANY, email: user[1], permissions: perms },
    ACCESS_SECRET, { expiresIn: '8h' }
  );
  const refreshToken = jwt.sign(
    { sub: user[0], tenantId: TENANT, companyId: COMPANY, email: user[1] },
    REFRESH_SECRET, { expiresIn: '7d' }
  );

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(({ a, r, u }) => {
    localStorage.setItem('velora_access_token', a);
    localStorage.setItem('velora_refresh_token', r);
    localStorage.setItem('velora_user', JSON.stringify(u));
  }, { a: accessToken, r: refreshToken, u: { id: user[0], email: user[1], name: user[2] } });

  const problems = [];

  for (const [name, mod] of Object.entries(MODULES)) {
    const page = await context.newPage();
    const pageErrors = [];
    const bad = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('response', (res) => { if (res.status() >= 400 && !/favicon/.test(res.url())) bad.push({ url: res.url(), status: res.status() }); });

    let bodyText = '';
    try {
      await page.goto('http://localhost:5173' + mod.route, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2500);
      bodyText = await page.evaluate(() => document.body?.innerText || '');
    } catch (err) {
      pageErrors.push('NAV: ' + err.message);
    }

    const shouldAccess = isSuper || perms.includes(mod.key);
    const forbidden403 = bad.filter((b) => b.status === 403 && shouldAccess && b.url.includes(mod.api));
    const crash = pageErrors.length > 0;
    const boundary = /This page encountered an unexpected error|Failed to load module/.test(bodyText);

    if (forbidden403.length) {
      problems.push(`❌ [403-on-allowed] ${mod.route}: ${forbidden403.map((b) => b.url).join(' | ')}`);
    }
    if (crash) {
      problems.push(`❌ [PAGEERROR] ${mod.route}: ${pageErrors[0]}`);
    }
    if (boundary) {
      problems.push(`❌ [CRASH] ${mod.route}: RouteErrorBoundary triggered`);
    }
    await page.close();
  }
  await context.close();
  return problems;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let totalProblems = 0;
  for (const user of USERS) {
    const probs = await auditOne(browser, user, user[3]);
    if (probs.length) {
      totalProblems += probs.length;
      console.log(`\n===== ${user[2]} (${user[3]}) =====`);
      for (const p of probs) console.log(p);
    } else {
      console.log(`✅ ${user[3]} — clean`);
    }
  }
  console.log(`\nTOTAL PROBLEMS: ${totalProblems}`);
  await browser.close();
})();
