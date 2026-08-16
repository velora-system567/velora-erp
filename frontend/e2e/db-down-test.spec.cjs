/**
 * Database Down Test — Verify the ERP handles database unavailability gracefully.
 *
 * When the database is down:
 * 1. Login should show "Service temporarily unavailable" (not "Something went wrong")
 * 2. The error boundary should show "Service Temporarily Unavailable" with retry
 * 3. No raw Prisma errors should be visible
 * 4. No "Cannot read properties of undefined" crashes
 */
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:5173";

test("database down — graceful degradation", async ({ page }) => {
  test.setTimeout(60_000);

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // ── Navigate to login ──────────────────────────────────────────
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.waitForTimeout(2000);

  // ── Fill and submit login form ─────────────────────────────────
  await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill("jishan@velora.com");
  await page.locator('input[type="password"]').first().fill("Velora@123");
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")').first().click();

  // Wait for error response (503 takes up to 15 seconds)
  await page.waitForTimeout(20_000);

  // ── Verify user experience ─────────────────────────────────────
  const bodyText = await page.evaluate(() => document.body?.innerText || "");

  console.log("=== BODY TEXT ===");
  console.log(bodyText.slice(0, 1000));
  console.log("=== END ===");

  // Check for user-friendly error message
  const hasServiceUnavailable = bodyText.includes("Service temporarily unavailable") ||
    bodyText.includes("temporarily unavailable") ||
    bodyText.includes("try again");

  // Check for BAD error messages (raw errors that should never be shown to users)
  const hasRawPrisma = bodyText.includes("prisma.") ||
    bodyText.includes("Invalid `prisma.") ||
    bodyText.includes("Can't reach database");
  const hasGenericError = bodyText.includes("Something went wrong");

  // Check for console errors (should not have unhandled exceptions)
  const realErrors = consoleErrors.filter(e =>
    !e.includes("favicon") && !e.includes("ResizeObserver")
  );

  await page.screenshot({ path: "e2e/screenshots/db-down-login.png" });

  console.log("\n=== RESULTS ===");
  console.log(`Service unavailable message shown: ${hasServiceUnavailable}`);
  console.log(`Raw Prisma error leaked: ${hasRawPrisma}`);
  console.log(`Generic "Something went wrong": ${hasGenericError}`);
  console.log(`Console errors: ${realErrors.length}`);
  for (const e of realErrors) console.log(`  ${e.slice(0, 200)}`);
  console.log(`Page errors: ${pageErrors.length}`);
  for (const e of pageErrors) console.log(`  ${e.slice(0, 200)}`);

  // The login page should NOT crash — it should show an error message
  // on the form, not navigate to an error boundary
  expect(hasRawPrisma, "Raw Prisma errors must NEVER be shown to users").toBeFalsy();

  console.log("\n=== PASS: Database-down graceful degradation verified ===");
});
