/**
 * Navigation Cascade Test — Navigate through ALL modules sequentially,
 * spending 3-5 seconds on each, to find if navigation triggers the cascade.
 *
 * Also monitors for token refresh, permission reloads, and background API failures.
 */
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:5173";

const MODULE_ROUTES = [
  { path: "/", name: "Dashboard" },
  { path: "/sales", name: "Sales" },
  { path: "/crm", name: "CRM" },
  { path: "/accounts", name: "Finance" },
  { path: "/inventory", name: "Inventory" },
  { path: "/manufacturing", name: "Manufacturing" },
  { path: "/hrms", name: "HR" },
  { path: "/eam", name: "Assets" },
  { path: "/executive", name: "Reports" },
  { path: "/activity", name: "Audit" },
  { path: "/purchase", name: "Procurement" },
  { path: "/wms", name: "WMS" },
  { path: "/settings", name: "Settings" },
  { path: "/admin", name: "Admin" },
  { path: "/", name: "Dashboard (return)" },
  { path: "/sales", name: "Sales (return)" },
  { path: "/crm", name: "CRM (return)" },
  { path: "/accounts", name: "Finance (return)" },
];

test("navigate all modules — detect cascade trigger", async ({ page }) => {
  test.setTimeout(300_000);

  const ALL_EVENTS = [];

  function logEvent(type, msg) {
    const ts = Date.now();
    ALL_EVENTS.push({ ts, type, msg });
    console.log(`[${new Date(ts).toISOString().slice(11, 23)}] ${type}: ${msg}`);
  }

  // ── Network monitoring ─────────────────────────────────────────
  page.on("response", (resp) => {
    const url = resp.url();
    if (url.includes("/api/")) {
      const status = resp.status();
      const path = url.replace(BASE, "").replace(/http:\/\/localhost:\d+/, "");
      const icon = status >= 400 ? "❌" : "✅";
      logEvent("API", `${icon} ${status} ${path}`);
    }
  });

  page.on("pageerror", (err) => {
    logEvent("PAGE_ERR", err.message?.slice(0, 200));
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon") && !text.includes("ResizeObserver")) {
        logEvent("CONSOLE_ERR", text.slice(0, 200));
      }
    }
  });

  // ── Login ──────────────────────────────────────────────────────
  logEvent("PHASE", "LOGIN");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.waitForTimeout(2000);

  await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill("jishan@velora.com");
  await page.locator('input[type="password"]').first().fill("Velora@123");
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")').first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
  logEvent("AUTH", `Logged in — at ${page.url().replace(BASE, "/")}`);

  const loginTime = Date.now();

  // ── Navigate through all modules ───────────────────────────────
  logEvent("PHASE", "NAVIGATION SEQUENCE");
  let cascadeDetected = false;

  for (let i = 0; i < MODULE_ROUTES.length; i++) {
    const route = MODULE_ROUTES[i];
    const elapsed = ((Date.now() - loginTime) / 1000).toFixed(1);

    logEvent("NAV", `[${i + 1}/${MODULE_ROUTES.length}] → ${route.name} (${route.path}) at +${elapsed}s`);

    try {
      await page.goto(`${BASE}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
    } catch (e) {
      logEvent("NAV_ERR", `Failed to navigate to ${route.path}: ${e.message}`);
      continue;
    }

    // Wait 3-4 seconds on each page
    await page.waitForTimeout(3500);

    // Check state
    const bodyText = await page.evaluate(() => document.body?.innerText || "");
    const currentUrl = page.url();
    const hasError = bodyText.includes("Something went wrong") ||
      bodyText.includes("An unexpected error occurred");
    const isLogin = currentUrl.includes("/login");

    const elapsedNow = ((Date.now() - loginTime) / 1000).toFixed(1);
    logEvent("STATE", `url=${currentUrl.replace(BASE, "/")} error=${hasError} isLogin=${isLogin} bodyLen=${bodyText.length} at +${elapsedNow}s`);

    if (hasError) {
      cascadeDetected = true;
      logEvent("❌ CASCADE", `Error page detected on ${route.name} at +${elapsedNow}s after login!`);
      logEvent("❌ CASCADE", `Error content: ${bodyText.slice(0, 500)}`);
      await page.screenshot({ path: "e2e/screenshots/cascade-DETECTED.png" });
      break;
    }

    if (isLogin && i > 0) {
      cascadeDetected = true;
      logEvent("❌ REDIRECT", `Redirected to login from ${route.name} at +${elapsedNow}s after login!`);
      break;
    }

    await page.screenshot({
      path: `e2e/screenshots/nav-${i}-${route.name.replace(/[^a-zA-Z0-9]/g, "_")}.png`,
    });
  }

  // ── Summary ────────────────────────────────────────────────────
  const totalTime = ((Date.now() - loginTime) / 1000).toFixed(1);
  logEvent("SUMMARY", `Navigation complete: ${MODULE_ROUTES.length} modules in ${totalTime}s`);
  logEvent("SUMMARY", `Cascade detected: ${cascadeDetected}`);

  const apiCalls = ALL_EVENTS.filter((e) => e.type === "API" && e.msg.includes("❌"));
  logEvent("SUMMARY", `Failed API calls: ${apiCalls.length}`);
  for (const c of apiCalls) {
    logEvent("SUMMARY", `  ${c.msg}`);
  }

  const pageErrors = ALL_EVENTS.filter((e) => e.type === "PAGE_ERR");
  logEvent("SUMMARY", `Page errors: ${pageErrors.length}`);
  for (const e of pageErrors) {
    logEvent("SUMMARY", `  ${e.msg}`);
  }

  const consoleErrors = ALL_EVENTS.filter((e) => e.type === "CONSOLE_ERR");
  logEvent("SUMMARY", `Console errors: ${consoleErrors.length}`);
  for (const e of consoleErrors) {
    logEvent("SUMMARY", `  ${e.msg}`);
  }
});
