/**
 * Sales Crash Reproduction — Navigate to /sales and capture EVERY exception.
 */
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:5173";

test("Sales module — reproduce crash", async ({ page }) => {
  test.setTimeout(120_000);

  const exceptions = [];
  const consoleErrors = [];
  const networkErrors = [];

  page.on("pageerror", (err) => {
    exceptions.push({ message: err.message, stack: err.stack });
    console.error(`PAGE_ERROR: ${err.message}`);
    console.error(`STACK: ${err.stack?.slice(0, 500)}`);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      consoleErrors.push(text);
      console.error(`CONSOLE_ERR: ${text.slice(0, 300)}`);
    }
  });

  page.on("response", (resp) => {
    if (resp.url().includes("/api/") && resp.status() >= 400) {
      networkErrors.push(`${resp.status()} ${resp.url().replace(BASE, "")}`);
    }
  });

  // Login
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill("jishan@velora.com");
  await page.locator('input[type="password"]').first().fill("Velora@123");
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")').first().click();

  // Wait for either redirect or error
  await page.waitForTimeout(5000);

  // Check if we're still on login (DB down) or redirected (DB up)
  const currentUrl = page.url();
  console.log(`After login: URL = ${currentUrl.replace(BASE, "/")}`);

  if (currentUrl.includes("/login")) {
    // DB is down — can't test Sales module
    console.log("Database is down — cannot navigate to Sales module");
    console.log("Waiting 60 seconds for DB to come back...");
    await page.waitForTimeout(60_000);
    // Check again
    if (page.url().includes("/login")) {
      console.log("Database still down after 60s — skipping Sales test");
      return;
    }
  }

  // Navigate to Sales
  console.log("Navigating to /sales...");
  await page.goto(`${BASE}/sales`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(8000);

  // Capture state
  const bodyText = await page.evaluate(() => document.body?.innerText || "");
  const hasError = bodyText.includes("Something went wrong") ||
    bodyText.includes("An unexpected error occurred") ||
    bodyText.includes("Service Temporarily Unavailable");

  await page.screenshot({ path: "e2e/screenshots/sales-crash-test.png" });

  console.log("\n=== RESULTS ===");
  console.log(`Page errors (React exceptions): ${exceptions.length}`);
  for (const e of exceptions) {
    console.log(`  ❌ ${e.message}`);
    console.log(`     ${e.stack?.slice(0, 300)}`);
  }
  console.log(`Console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors) {
    console.log(`  ${e.slice(0, 200)}`);
  }
  console.log(`Network errors: ${networkErrors.length}`);
  for (const e of networkErrors) {
    console.log(`  ${e}`);
  }
  console.log(`Error page visible: ${hasError}`);
  console.log(`Body text length: ${bodyText.length}`);
  console.log(`Body preview: ${bodyText.slice(0, 200)}`);

  // FAIL if there are React exceptions (the "Something went wrong" trigger)
  expect(exceptions.length, `Sales module has ${exceptions.length} React exceptions`).toBe(0);
});
