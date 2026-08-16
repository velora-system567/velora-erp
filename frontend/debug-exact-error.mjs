/**
 * P0 Debug — Capture the EXACT exception that triggers the error boundary.
 */
import { chromium } from 'playwright';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_ACCESS_SECRET = 'velora-erp-access-secret-key-2026-min-24-chars';
const JWT_REFRESH_SECRET = 'velora-erp-refresh-secret-key-2026-min-24-chars';

(async () => {
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { isDeleted: false, isActive: true, email: 'aarti.rao51@velora.com' },
    include: { userRoles: { include: { role: true } } },
  });

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

  // Capture ALL console output with full args
  const consoleOutput = [];
  page.on('console', (msg) => {
    consoleOutput.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    });
  });

  page.on('pageerror', (err) => {
    console.log(`\n🔴 PAGE ERROR: ${err.message}`);
    console.log(err.stack);
  });

  console.log('Navigating to /sales...');
  await page.goto('http://localhost:5173/sales', {
    waitUntil: 'networkidle', timeout: 20000,
  });
  await page.waitForTimeout(5000);

  // Get FULL page text
  const fullText = await page.evaluate(() => document.body.innerText);
  console.log(`\n--- FULL PAGE TEXT ---\n${fullText}\n--- END ---`);

  // Get all error console entries
  console.log(`\n--- ALL CONSOLE OUTPUT (${consoleOutput.length} entries) ---`);
  for (const entry of consoleOutput) {
    if (entry.type === 'error' || entry.type === 'warn') {
      console.log(`[${entry.type}] ${entry.text}`);
      if (entry.location.url) {
        console.log(`  at ${entry.location.url}:${entry.location.lineNumber}:${entry.location.columnNumber}`);
      }
    }
  }

  // Check if React is reporting errors via its internal error handler
  const reactErrors = consoleOutput.filter(c =>
    c.text.includes('React') || c.text.includes('Error') || c.text.includes('error') ||
    c.text.includes('Boundary') || c.text.includes('boundary') ||
    c.text.includes('permission') || c.text.includes('Permission')
  );

  console.log(`\n--- RELEVANT CONSOLE ENTRIES ---`);
  for (const entry of reactErrors) {
    console.log(`[${entry.type}] ${entry.text}`);
  }

  await browser.close();
})();
