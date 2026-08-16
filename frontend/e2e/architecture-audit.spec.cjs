/**
 * Architecture Audit — Comprehensive test of ALL ERP routes.
 *
 * Detects:
 * - "Something went wrong" error boundary screens
 * - "Access Denied" screens (unauthorized)
 * - White / blank screens
 * - Console errors
 * - Network (API) failures
 * - Unhandled exceptions (React crash boundary)
 * - "[object Object]" leaks in UI
 * - "undefined" text leaks
 */
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const CREDS = { email: "jishan@velora.com", password: "Velora@123" };

const ALL_ROUTES = [
  { path: "/login", name: "Login", public: true },
  { path: "/register", name: "Register", public: true },
  { path: "/forgot-password", name: "Forgot Password", public: true },
  { path: "/", name: "Dashboard" },
  { path: "/company", name: "Company" },
  { path: "/branches", name: "Branches" },
  { path: "/users", name: "Users" },
  { path: "/products", name: "Products" },
  { path: "/sales", name: "Sales" },
  { path: "/sales/dashboard", name: "Owner Dashboard" },
  { path: "/purchase", name: "Purchase" },
  { path: "/inventory", name: "Inventory" },
  { path: "/inventory/products", name: "Inventory Products" },
  { path: "/inventory/reports", name: "Inventory Reports" },
  { path: "/inventory/suppliers", name: "Inventory Suppliers" },
  { path: "/accounts", name: "Accounts (Finance)" },
  { path: "/manufacturing", name: "Manufacturing" },
  { path: "/crm", name: "CRM" },
  { path: "/wms", name: "WMS" },
  { path: "/executive", name: "Executive (Reports)" },
  { path: "/hrms", name: "HRMS" },
  { path: "/eam", name: "EAM" },
  { path: "/supplier-portal", name: "Supplier Portal" },
  { path: "/activity", name: "Audit Log" },
  { path: "/settings", name: "Settings" },
  { path: "/admin", name: "Admin" },
  { path: "/access-denied", name: "Access Denied" },
];

const FAIL_PATTERNS = [
  "Something went wrong",
  "An unexpected error occurred",
  "Failed to load module",
  "Failed to fetch",
  "Permission denied",
];

test("full architecture audit — every route", async ({ page }) => {
  test.setTimeout(600_000);

  // ── Auth via UI login ───────────────────────────────────────────
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.waitForTimeout(2000);

  // Fill login form and submit
  await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill(CREDS.email);
  await page.locator('input[type="password"]').first().fill(CREDS.password);
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")').first().click();

  // Wait for redirect away from login (indicates successful auth)
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });

  // Verify auth state in localStorage
  const hasToken = await page.evaluate(() => !!localStorage.getItem("velora_access_token"));
  expect(hasToken, "Auth token must be stored after login").toBeTruthy();

  // Navigate to dashboard to confirm authenticated state
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(2000);

  // Verify we're NOT on the login page (auth worked)
  const postLoginUrl = page.url();
  expect(postLoginUrl).not.toContain("/login");

  // ── Route audit ────────────────────────────────────────────────
  const results = [];

  for (const route of ALL_ROUTES) {
    const consoleErrors = [];
    const pageErrors = [];
    const networkErrors = [];
    const failedRequests = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push({ message: err.message, stack: err.stack || "" });
    });
    page.on("requestfailed", (req) => {
      failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
    });
    page.on("response", (resp) => {
      const s = resp.status();
      const url = resp.url();
      if (s >= 400 && url.includes("/api/")) {
        networkErrors.push(`${s} ${url.replace(BASE, "")}`);
      }
    });

    try {
      await page.goto(`${BASE}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForTimeout(5000);

      const bodyText = await page.evaluate(() => document.body?.innerText || "");
      const bodyHTML = await page.evaluate(() => document.body?.innerHTML || "");
      const isBlank = bodyHTML.trim().length < 50;

      await page.screenshot({
        path: `e2e/screenshots/audit-${route.name.replace(/[^a-zA-Z0-9]/g, "_")}.png`,
        fullPage: false,
      });

      // Filter benign noise
      const realConsoleErrors = consoleErrors.filter(
        (e) =>
          !e.includes("favicon") &&
          !e.includes("ResizeObserver") &&
          !e.includes("React DevTools") &&
          !e.includes("[RouteErrorBoundary]")
      );

      // Check for failure patterns in body text
      const foundPatterns = FAIL_PATTERNS.filter((p) =>
        bodyText.toLowerCase().includes(p.toLowerCase())
      );
      const hasObjectLeak = bodyText.includes("[object Object]");
      const hasUndefinedLeak =
        bodyText.includes("undefined") && !bodyText.includes("Source map");

      let status = "OK";
      if (isBlank) status = "BLANK";
      else if (pageErrors.length > 0) status = "EXCEPTION";
      else if (foundPatterns.length > 0) status = "ERROR_PAGE";
      else if (hasObjectLeak) status = "OBJECT_LEAK";
      else if (hasUndefinedLeak) status = "UNDEFINED_LEAK";
      else if (realConsoleErrors.length > 0) status = "CONSOLE_ERROR";
      else if (networkErrors.length > 0) status = "API_ERROR";

      results.push({
        ...route,
        status,
        bodyLen: bodyText.length,
        foundPatterns,
        pageErrors: pageErrors.map((e) => e.message),
        consoleErrors: realConsoleErrors,
        networkErrors,
        failedRequests,
      });

      const icon = status === "OK" ? "✅" : "❌";
      console.log(
        `${icon} ${status.padEnd(14)} ${route.name.padEnd(22)} ${route.path.padEnd(25)} len=${bodyText.length}`
      );
      if (status !== "OK") {
        if (foundPatterns.length) console.log(`   FAIL_PATTERNS: ${foundPatterns.join(", ")}`);
        if (pageErrors.length) console.log(`   PAGE_ERROR: ${pageErrors[0].message}`);
        if (realConsoleErrors.length) console.log(`   CONSOLE: ${realConsoleErrors.slice(0, 2).join(" | ")}`);
        if (networkErrors.length) console.log(`   NETWORK: ${networkErrors.slice(0, 2).join(" | ")}`);
      }
    } catch (err) {
      results.push({ ...route, status: "NAV_FAIL", error: err.message });
      console.log(`❌ NAV_FAIL    ${route.name.padEnd(22)} ${route.path} — ${err.message}`);
    }

    page.removeAllListeners("console");
    page.removeAllListeners("pageerror");
    page.removeAllListeners("requestfailed");
    page.removeAllListeners("response");
  }

  // ── Summary ────────────────────────────────────────────────────
  const ok = results.filter((r) => r.status === "OK");
  const failed = results.filter((r) => r.status !== "OK");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`ARCHITECTURE AUDIT RESULTS`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Total: ${results.length} | OK: ${ok.length} | FAILED: ${failed.length}`);

  if (failed.length) {
    console.log(`\nFailed routes:`);
    for (const f of failed) {
      console.log(`  ❌ ${f.name} (${f.path}) — ${f.status}`);
    }
  }
  console.log(`${"=".repeat(60)}`);

  // Fail the test if any route failed
  expect(failed.length, `Found ${failed.length} failing routes`).toBe(0);
});
