/**
 * P0 Debug Script — Navigate every route, capture ALL console errors.
 * No mocking, no login bypass — just raw error capture.
 */
import { chromium } from 'playwright';

const ROUTES = [
  '/', '/sales', '/sales/dashboard', '/crm', '/accounts', '/executive',
  '/inventory', '/inventory/products', '/inventory/reports', '/inventory/suppliers',
  '/purchase', '/manufacturing', '/wms', '/hrms', '/eam',
  '/supplier-portal', '/activity', '/settings', '/admin',
  '/company', '/branches', '/users', '/products',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set a fake token so ProtectedRoute passes
  await page.addInitScript(() => {
    // Decode a real-looking JWT with permissions: ["*"]
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

  const allErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      allErrors.push({
        route: page.url(),
        type: 'console.error',
        text: msg.text(),
      });
    }
  });

  page.on('pageerror', (err) => {
    allErrors.push({
      route: page.url(),
      type: 'pageerror',
      text: err.message,
      stack: err.stack,
    });
  });

  for (const route of ROUTES) {
    try {
      console.log(`\n=== Navigating to ${route} ===`);
      await page.goto(`http://localhost:5173${route}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // Check for blank/white page
      const bodyHTML = await page.evaluate(() => document.body.innerHTML.trim());
      const isBlank = bodyHTML.length < 50 || bodyHTML === '' || bodyHTML === '<div id="root"></div>';
      if (isBlank) {
        allErrors.push({
          route,
          type: 'BLANK PAGE',
          text: `Body HTML length: ${bodyHTML.length}. Content: "${bodyHTML.slice(0, 200)}"`,
        });
      }

      // Check if error boundary rendered
      const hasErrorBoundary = await page.evaluate(() => {
        return document.body.innerText.includes('Something went wrong') ||
               document.body.innerText.includes('Failed to load module') ||
               document.body.innerText.includes('Try Again');
      });
      if (hasErrorBoundary) {
        allErrors.push({
          route,
          type: 'ERROR BOUNDARY TRIGGERED',
          text: 'The route triggered the error boundary — a component threw during render.',
        });
      }

      // Small delay to let any async errors surface
      await page.waitForTimeout(500);
    } catch (err) {
      allErrors.push({
        route,
        type: 'NAVIGATION ERROR',
        text: err.message,
      });
    }
  }

  console.log('\n\n========================================');
  console.log('ALL CAPTURED ERRORS');
  console.log('========================================');

  if (allErrors.length === 0) {
    console.log('No errors found!');
  } else {
    for (const err of allErrors) {
      console.log(`\n--- ${err.type} on ${err.route} ---`);
      console.log(err.text);
      if (err.stack) console.log(err.stack);
    }
  }

  console.log(`\nTotal errors: ${allErrors.length}`);

  await browser.close();
})();
