/**
 * P0 Debug — Intercept API responses and strip specific fields to find crashes.
 *
 * For each route:
 *   1. Intercept the route's API responses
 *   2. Strip top-level fields one at a time
 *   3. If the page crashes (pageerror or blank), we found the root cause
 */
import { chromium } from 'playwright';

// Route → API patterns that feed data to the page
const ROUTE_API_MAP = [
  {
    route: '/sales',
    label: 'Sales',
    stripTargets: [
      { field: 'data', replaceWith: null },
      { field: 'data.kpis', replaceWith: null },
      { field: 'data.recentActivity', replaceWith: null },
      { field: 'data.topCustomers', replaceWith: null },
    ],
  },
  {
    route: '/crm',
    label: 'CRM',
    stripTargets: [
      { field: 'data', replaceWith: null },
      { field: 'data.kpis', replaceWith: null },
      { field: 'data.pipeline', replaceWith: null },
    ],
  },
  {
    route: '/accounts',
    label: 'Finance',
    stripTargets: [
      { field: 'data', replaceWith: null },
      { field: 'data.kpis', replaceWith: null },
      { field: 'data.chartOfAccounts', replaceWith: null },
    ],
  },
  {
    route: '/executive',
    label: 'Reports',
    stripTargets: [
      { field: 'data', replaceWith: null },
      { field: 'data.kpis', replaceWith: null },
      { field: 'data.health', replaceWith: null },
      { field: 'data.timestamp', replaceWith: null },
    ],
  },
  {
    route: '/',
    label: 'Dashboard',
    stripTargets: [
      { field: 'data', replaceWith: null },
      { field: 'data.kpis', replaceWith: null },
      { field: 'data.rows', replaceWith: null },
    ],
  },
  {
    route: '/manufacturing',
    label: 'Manufacturing',
    stripTargets: [
      { field: 'data', replaceWith: null },
      { field: 'data.locked', replaceWith: null },
    ],
  },
  {
    route: '/inventory',
    label: 'Inventory',
    stripTargets: [
      { field: 'data', replaceWith: null },
      { field: 'data.kpis', replaceWith: null },
    ],
  },
  {
    route: '/purchase',
    label: 'Purchase',
    stripTargets: [
      { field: 'data', replaceWith: null },
      { field: 'data.kpis', replaceWith: null },
    ],
  },
  {
    route: '/hrms',
    label: 'HRMS',
    stripTargets: [
      { field: 'data', replaceWith: null },
      { field: 'data.kpis', replaceWith: null },
    ],
  },
  {
    route: '/wms',
    label: 'WMS',
    stripTargets: [
      { field: 'data', replaceWith: null },
    ],
  },
  {
    route: '/eam',
    label: 'EAM',
    stripTargets: [
      { field: 'data', replaceWith: null },
      { field: 'data.kpis', replaceWith: null },
    ],
  },
];

/**
 * Deep-set an object field by dot-path.
 * E.g., setField(obj, 'data.kpis', null) → obj.data.kpis = null
 */
function setField(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== 'object') return false;
    if (cur[parts[i]] == null) return false; // path doesn't exist in response
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return true;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const crashes = [];

  for (const { route, label, stripTargets } of ROUTE_API_MAP) {
    for (const { field, replaceWith } of stripTargets) {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Fake auth token
      await page.addInitScript(() => {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
          sub: 'test-user-id', email: 'admin@velora.com', name: 'Admin',
          permissions: ['*'], exp: Math.floor(Date.now() / 1000) + 86400,
        }));
        localStorage.setItem('velora_access_token', `${header}.${payload}.fake-sig`);
        localStorage.setItem('velora_refresh_token', 'fake-refresh');
        localStorage.setItem('velora_user', JSON.stringify({
          id: 'test-user-id', email: 'admin@velora.com', name: 'Admin'
        }));
      });

      const pageErrors = [];
      page.on('pageerror', (err) => {
        pageErrors.push({ message: err.message, stack: err.stack });
      });

      // Intercept API responses and corrupt data
      await page.route('**/api/**', async (route) => {
        const response = await route.fetch();
        const status = response.status();
        const contentType = response.headers()['content-type'] || '';

        if (status === 200 && contentType.includes('json')) {
          try {
            const body = await response.json();
            // Only corrupt successful responses
            if (body && body.success && body.data) {
              setField(body, field, replaceWith);
            }
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(body),
            });
          } catch {
            await route.fulfill({ response });
          }
        } else {
          await route.fulfill({ response });
        }
      });

      try {
        await page.goto(`http://localhost:5173${route}`, {
          waitUntil: 'networkidle',
          timeout: 15000,
        });
        await page.waitForTimeout(2000);

        const hasBoundary = await page.evaluate(() => {
          const t = document.body.innerText;
          return t.includes('Something went wrong') || t.includes('Try Again');
        });

        const isBlank = await page.evaluate(() => {
          const root = document.getElementById('root');
          return !root || root.innerHTML.trim().length < 50;
        });

        // Filter meaningful errors
        const meaningful = pageErrors.filter(e =>
          !e.message.includes('ResizeObserver') &&
          !e.message.includes('401')
        );

        if (meaningful.length > 0 || hasBoundary || isBlank) {
          const label2 = `strip ${field} → ${replaceWith}`;
          console.log(`\n❌ ${label} (${route}) — ${label2}`);
          if (hasBoundary) console.log(`  Error Boundary triggered!`);
          if (isBlank) console.log(`  Page is BLANK!`);
          for (const err of meaningful) {
            console.log(`  pageerror: ${err.message}`);
            if (err.stack) {
              const srcLines = err.stack.split('\n').filter(l =>
                l.includes('src/') || l.includes('localhost')
              ).slice(0, 8);
              for (const l of srcLines) console.log(`    ${l}`);
            }
          }
          crashes.push({ route, label, field, replaceWith, errors: meaningful, hasBoundary, isBlank });
        } else {
          process.stdout.write(`✅ ${label} (${route}) strip ${field}\n`);
        }
      } catch (err) {
        console.log(`\n🔴 ${label} (${route}) — NAV ERROR: ${err.message}`);
      }

      await page.close();
      await context.close();
    }
  }

  console.log('\n\n========================================');
  console.log('INTERCEPT CRASH SUMMARY');
  console.log('========================================');

  if (crashes.length === 0) {
    console.log('No crashes found from data stripping.');
  } else {
    for (const c of crashes) {
      console.log(`\n❌ ${c.label} (${c.route}) — strip "${c.field}"`);
      if (c.hasBoundary) console.log(`  → Error Boundary triggered`);
      if (c.isBlank) console.log(`  → Page is blank`);
      for (const e of c.errors) {
        console.log(`  → ${e.message}`);
        if (e.stack) {
          const lines = e.stack.split('\n').filter(l => l.includes('src/')).slice(0, 5);
          for (const l of lines) console.log(`    ${l}`);
        }
      }
    }
  }

  console.log(`\nTotal crashes: ${crashes.length}`);
  await browser.close();
})();
