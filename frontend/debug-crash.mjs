/**
 * P0 Debug — Intercept API responses to simulate broken data shapes.
 * This will reveal exactly which component crashes on which data shape.
 */
import { chromium } from 'playwright';

const ROUTES = [
  { route: '/', label: 'Dashboard', apiPatterns: ['/api/dashboard/kpis', '/api/dashboard/sales-chart', '/api/dashboard/top-items'] },
  { route: '/sales', label: 'Sales', apiPatterns: ['/api/customers', '/api/items', '/api/users', '/api/branches'] },
  { route: '/sales/dashboard', label: 'Sales Dashboard', apiPatterns: ['/api/sales/owner-dashboard'] },
  { route: '/crm', label: 'CRM', apiPatterns: ['/api/crm/dashboard'] },
  { route: '/accounts', label: 'Finance', apiPatterns: ['/api/accounts/dashboard'] },
  { route: '/executive', label: 'Reports', apiPatterns: ['/api/bi/executive-dashboard'] },
  { route: '/manufacturing', label: 'Manufacturing', apiPatterns: ['/api/manufacturing/access'] },
  { route: '/hrms', label: 'HR', apiPatterns: ['/api/hrms/dashboard'] },
  { route: '/wms', label: 'WMS', apiPatterns: ['/api/wms/dashboard'] },
  { route: '/eam', label: 'EAM', apiPatterns: ['/api/eam/dashboard'] },
  { route: '/inventory', label: 'Inventory', apiPatterns: ['/api/inventory/dashboard'] },
  { route: '/purchase', label: 'Procurement', apiPatterns: ['/api/purchase/dashboard'] },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // We'll capture page errors to find the REAL exceptions
  const crashes = [];

  for (const { route, label, apiPatterns } of ROUTES) {
    console.log(`\n=== Testing ${label} (${route}) ===`);

    const page = await context.newPage();

    // Set valid-looking tokens
    await page.addInitScript(() => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({
        sub: 'test-user-id',
        email: 'admin@velora.com',
        name: 'Admin',
        permissions: ['*'],
        exp: Math.floor(Date.now() / 1000) + 86400,
      }));
      const fakeToken = `${header}.${payload}.fake-sig`;
      localStorage.setItem('velora_access_token', fakeToken);
      localStorage.setItem('velora_refresh_token', 'fake-refresh');
      localStorage.setItem('velora_user', JSON.stringify({
        id: 'test-user-id', email: 'admin@velora.com', name: 'Admin'
      }));
    });

    const routeErrors = [];

    // Listen for uncaught errors
    page.on('pageerror', (err) => {
      routeErrors.push({
        type: 'pageerror',
        message: err.message,
        stack: err.stack,
      });
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('401') && !msg.text().includes('Failed to load resource')) {
        routeErrors.push({
          type: 'console.error',
          text: msg.text(),
        });
      }
    });

    try {
      await page.goto(`http://localhost:5173${route}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // Wait for React to settle
      await page.waitForTimeout(2000);

      // Check for error boundary
      const hasErrorBoundary = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('Something went wrong') ||
               text.includes('Failed to load module') ||
               text.includes('Try Again');
      });

      // Check if page rendered actual content
      const hasContent = await page.evaluate(() => {
        const root = document.getElementById('root');
        if (!root) return false;
        const text = root.innerText.trim();
        return text.length > 50 && !text.includes('Something went wrong');
      });

      // Get visible text for debugging
      const visibleText = await page.evaluate(() => {
        return document.body.innerText.slice(0, 500);
      });

      if (hasErrorBoundary) {
        console.log(`  ❌ ERROR BOUNDARY TRIGGERED`);
        console.log(`  Visible text: ${visibleText.slice(0, 200)}`);
      } else if (!hasContent) {
        console.log(`  ⚠️  PAGE APPEARS BLANK or minimal content`);
        console.log(`  Visible text: "${visibleText.slice(0, 200)}"`);
      } else {
        console.log(`  ✅ Page rendered successfully`);
      }

      if (routeErrors.length > 0) {
        for (const err of routeErrors) {
          console.log(`  🔴 ${err.type}: ${err.message || err.text}`);
          if (err.stack) {
            // Extract just the first few lines of the stack
            const stackLines = err.stack.split('\n').slice(0, 5);
            console.log(`     Stack: ${stackLines.join('\n     ')}`);
          }
        }
        crashes.push({ route, label, errors: routeErrors });
      }
    } catch (err) {
      console.log(`  🔴 NAVIGATION FAILED: ${err.message}`);
      crashes.push({ route, label, errors: [{ type: 'nav-error', message: err.message }] });
    }

    await page.close();
  }

  console.log('\n\n========================================');
  console.log('CRASH SUMMARY');
  console.log('========================================');

  if (crashes.length === 0) {
    console.log('No crashes found with fake tokens.');
    console.log('The crash must require REAL API data.');
  } else {
    for (const { route, label, errors } of crashes) {
      console.log(`\n❌ ${label} (${route}):`);
      for (const err of errors) {
        console.log(`   ${err.type}: ${err.message || err.text}`);
        if (err.stack) {
          const lines = err.stack.split('\n').slice(0, 8);
          for (const line of lines) {
            console.log(`     ${line}`);
          }
        }
      }
    }
  }

  await browser.close();
})();
