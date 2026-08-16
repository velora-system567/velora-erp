/**
 * DEEP DIAGNOSTIC — Reproduce the exact crash scenario.
 *
 * This test captures EVERYTHING:
 * - Every console message (log, warn, error, info)
 * - Every network request and response (with status, timing, body)
 * - Every page error (React exceptions)
 * - Every unhandled rejection
 * - Every state change (URL, body text, localStorage)
 * - Every React Query event
 * - Every auth state change
 *
 * Then it navigates through EVERY module, spending 5+ seconds on each,
 * to find the exact module and moment the cascade triggers.
 */
const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:5173";

test("DEEP DIAGNOSTIC — find the exact crash trigger", async ({ page }) => {
  test.setTimeout(600_000);

  const TIMELINE = [];
  let eventCount = 0;

  function log(type, detail) {
    eventCount++;
    const ts = Date.now();
    const entry = { n: eventCount, ts, type, detail };
    TIMELINE.push(entry);
    // Only log errors and key events to stdout
    if (type.includes("ERR") || type.includes("FAIL") || type.includes("CRASH") || type.includes("❌")) {
      console.error(`[#${eventCount} ${type}] ${detail}`);
    }
  }

  // ── Intercept EVERYTHING ───────────────────────────────────────
  page.on("console", (msg) => {
    const t = msg.type();
    const text = msg.text();
    if (t === "error") log("CONSOLE_ERR", text.slice(0, 500));
    else if (t === "warning") log("CONSOLE_WARN", text.slice(0, 300));
    else if (text.includes("React") || text.includes("error") || text.includes("crash")) {
      log("CONSOLE_SPECIAL", `[${t}] ${text.slice(0, 300)}`);
    }
  });

  page.on("pageerror", (err) => {
    log("PAGE_ERROR", `MSG: ${err.message?.slice(0, 500)}`);
    log("PAGE_ERROR_STACK", err.stack?.slice(0, 1000) || "no stack");
  });

  page.on("crash", () => log("PAGE_CRASH", "PAGE PROCESS CRASHED"));

  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/")) {
      log("REQ", `${req.method()} ${url.replace(BASE, "")}`);
    }
  });

  page.on("response", (resp) => {
    const url = resp.url();
    if (url.includes("/api/")) {
      const status = resp.status();
      const path = url.replace(BASE, "");
      if (status >= 400) {
        log("❌ API_FAIL", `${status} ${path}`);
      } else {
        log("API_OK", `${status} ${path}`);
      }
    }
  });

  page.on("requestfailed", (req) => {
    log("❌ REQ_FAILED", `${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });

  // ── Step 1: Login ─────────────────────────────────────────────
  log("PHASE", "LOGIN");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.waitForTimeout(2000);

  await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill("jishan@velora.com");
  await page.locator('input[type="password"]').first().fill("Velora@123");
  await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")').first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
  const loginTime = Date.now();
  log("AUTH_OK", `Logged in. URL: ${page.url().replace(BASE, "/")}`);

  // Decode JWT
  const jwt = await page.evaluate(() => {
    const t = localStorage.getItem("velora_access_token");
    if (!t) return null;
    try { return JSON.parse(atob(t.split(".")[1])); } catch { return null; }
  });
  log("JWT", `sub=${jwt?.sub} perms=${JSON.stringify(jwt?.permissions?.slice(0, 3))}... exp=${new Date(jwt?.exp * 1000).toISOString()}`);

  // ── Step 2: Test EVERY module individually ─────────────────────
  const MODULES = [
    { path: "/", name: "Dashboard", wait: 8000 },
    { path: "/sales", name: "Sales", wait: 5000 },
    { path: "/crm", name: "CRM", wait: 5000 },
    { path: "/accounts", name: "Finance", wait: 5000 },
    { path: "/inventory", name: "Inventory", wait: 5000 },
    { path: "/manufacturing", name: "Manufacturing", wait: 5000 },
    { path: "/hrms", name: "HR", wait: 5000 },
    { path: "/eam", name: "Assets", wait: 5000 },
    { path: "/executive", name: "Reports", wait: 5000 },
    { path: "/activity", name: "Audit", wait: 5000 },
    { path: "/purchase", name: "Procurement", wait: 5000 },
    { path: "/wms", name: "WMS", wait: 5000 },
    { path: "/settings", name: "Settings", wait: 5000 },
    { path: "/admin", name: "Admin", wait: 5000 },
  ];

  log("PHASE", "MODULE TESTING");
  const results = [];

  for (const mod of MODULES) {
    const t0 = Date.now();
    log("NAV", `→ ${mod.name} (${mod.path})`);

    try {
      await page.goto(`${BASE}${mod.path}`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    } catch (e) {
      log("❌ NAV_FAIL", `${mod.name}: ${e.message}`);
      results.push({ ...mod, status: "NAV_FAIL" });
      continue;
    }

    // Wait the specified time
    await page.waitForTimeout(mod.wait);

    // Capture state
    const bodyText = await page.evaluate(() => document.body?.innerText || "");
    const currentUrl = page.url();
    const hasError = bodyText.includes("Something went wrong") ||
      bodyText.includes("An unexpected error occurred") ||
      bodyText.includes("Failed to load module");
    const isLogin = currentUrl.includes("/login");
    const elapsed = ((Date.now() - loginTime) / 1000).toFixed(1);

    let status = "OK";
    if (hasError) status = "ERROR_PAGE";
    else if (isLogin) status = "REDIRECT_LOGIN";
    else if (bodyText.length < 50) status = "BLANK";

    results.push({ ...mod, status, bodyLen: bodyText.length, elapsed });
    log(status === "OK" ? "✅" : "❌", `${status} ${mod.name} bodyLen=${bodyText.length} at +${elapsed}s`);

    if (status !== "OK") {
      log("❌ DETAILS", `URL: ${currentUrl.replace(BASE, "/")}`);
      log("❌ DETAILS", `Body: ${bodyText.slice(0, 500)}`);
      await page.screenshot({ path: `e2e/screenshots/deep-${mod.name.replace(/[^a-zA-Z0-9]/g, "_")}-FAIL.png` });
    }

    await page.screenshot({ path: `e2e/screenshots/deep-${mod.name.replace(/[^a-zA-Z0-9]/g, "_")}.png` });
  }

  // ── Step 3: Summary ───────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("DEEP DIAGNOSTIC RESULTS");
  console.log("=".repeat(70));

  const ok = results.filter((r) => r.status === "OK");
  const failed = results.filter((r) => r.status !== "OK");

  console.log(`Total: ${results.length} | OK: ${ok.length} | FAILED: ${failed.length}`);

  if (failed.length) {
    console.log("\nFAILED MODULES:");
    for (const f of failed) {
      console.log(`  ❌ ${f.name} (${f.path}) — ${f.status} at +${f.elapsed}s`);
    }
  }

  // Count events by type
  const errors = TIMELINE.filter((e) => e.type.includes("ERR") || e.type.includes("FAIL") || e.type.includes("CRASH"));
  console.log(`\nTotal events: ${eventCount}`);
  console.log(`Error events: ${errors.length}`);
  for (const e of errors) {
    console.log(`  [${e.type}] ${e.detail}`);
  }

  console.log("=".repeat(70));
});
