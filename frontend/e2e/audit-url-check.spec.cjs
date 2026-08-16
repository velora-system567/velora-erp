/**
 * Verify the audit-logs API call doesn't leak React Query internals into the URL.
 */
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:5173";

test("audit-logs URL must not contain React Query internals", async ({ page }) => {
  test.setTimeout(60_000);

  const badPatterns = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/audit-logs")) {
      if (url.includes("object") || url.includes("signal") || url.includes("queryKey") || url.includes("meta=undefined")) {
        badPatterns.push(url);
      }
    }
  });

  // Login via UI
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill("jishan@velora.com");
  await page.locator('input[type="password"]').first().fill("Velora@123");
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")').first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });

  // Navigate to audit log page
  await page.goto(`${BASE}/activity`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(5000);

  // Check results
  expect(badPatterns.length, `Found React Query internals in audit-logs URL: ${badPatterns.join(", ")}`).toBe(0);
  console.log("✅ audit-logs URL is clean — no React Query internal leakage");
});
